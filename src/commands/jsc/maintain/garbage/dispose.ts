import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';
import {
  GarbageCollectionUx,
  GarbageCollector,
  resolveDevhub,
  resolvePackageIds,
} from '../../../../garbage-collection/index.js';
import { GarbageDisposalUx, GarbageDisposer } from '../../../../garbage-disposal/index.js';
import type { GarbageDisposeResult } from '../../../../garbage-disposal/types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.dispose');

export default class JscMaintainGarbageDispose extends SfCommand<GarbageDisposeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'devhub-org': Flags.optionalHub({
      summary: messages.getMessage('flags.devhub-org.summary'),
      description: messages.getMessage('flags.devhub-org.description'),
      char: 'v',
      required: false,
    }),
    'metadata-type': Flags.string({
      multiple: true,
      char: 'm',
      summary: messages.getMessage('flags.metadata-type.summary'),
      description: messages.getMessage('flags.metadata-type.description'),
    }),
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      multiple: true,
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      description: messages.getMessage('flags.no-prompt.description'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<GarbageDisposeResult> {
    const { flags } = await this.parse(JscMaintainGarbageDispose);
    const orgConnection = flags['target-org'].getConnection(flags['api-version']);
    const devhubConnection = resolveDevhub(flags['target-org'], flags['devhub-org'], flags['api-version']);
    const collector = GarbageCollector.newInstance(orgConnection, devhubConnection);
    collector.on('resolveMemberStatus', (payload: CommandStatusEvent) => {
      this.info(payload.message!);
    });
    const garbage = await collector.export({
      includeOnly: flags['metadata-type'],
      packages: await resolvePackageIds(orgConnection, (msg) => this.info(msg), flags.package),
    });
    process.exitCode = 0;
    if (garbage.totalDeprecatedComponentCount === 0) {
      this.info(messages.getMessage('infos.no-garbage-found'));
      return { ...garbage, status: 'Skipped', disposed: {}, failed: [] };
    }
    new GarbageCollectionUx(this).printTable(garbage);
    if (!flags['no-prompt'] && !(await this.confirmDisposal(garbage.totalDeprecatedComponentCount, orgConnection))) {
      this.info(messages.getMessage('infos.aborted-by-user'));
      return { ...garbage, status: 'Skipped', disposed: {}, failed: [] };
    }

    this.spinner.start(messages.getMessage('infos.disposing'));
    const result = await this.subscribe(GarbageDisposer.newInstance(orgConnection)).dispose(garbage);
    this.spinner.stop(result.status);
    new GarbageDisposalUx(this).printFailures(result.failed, messages.getMessage('titles.failed'));
    if (result.status === 'Failed') {
      this.logToStderr(messages.getMessage('errors.disposal-failed', [result.failed.length]));
      process.exitCode = 1;
    } else {
      this.logSuccess(messages.getMessage('infos.disposal-succeeded', [countComponents(result.disposed)]));
      if (result.failed.length > 0) {
        this.warn(messages.getMessage('warnings.partial-success', [result.failed.length]));
      }
    }
    return result;
  }

  private subscribe(disposer: GarbageDisposer): GarbageDisposer {
    disposer.on('validationRound', ({ round, componentCount }) => {
      this.spinner.status = messages.getMessage('infos.validation-round', [round, componentCount]);
    });
    disposer.on('deployStarted', ({ deployId, validationId }) => {
      this.info(
        validationId
          ? messages.getMessage('infos.quick-deploy-started', [deployId, validationId])
          : messages.getMessage('infos.deploy-started', [deployId])
      );
    });
    disposer.on('deployProgress', ({ status, componentsDeployed, componentsTotal }) => {
      this.spinner.status = messages.getMessage('infos.deploy-status', [status, componentsDeployed, componentsTotal]);
    });
    return disposer;
  }

  private async confirmDisposal(componentCount: number, connection: Connection): Promise<boolean> {
    return this.confirm({
      message: messages.getMessage('confirmDisposal', [componentCount, connection.getUsername()]),
    });
  }
}

function countComponents(containers: GarbageDisposeResult['disposed']): number {
  return Object.values(containers).reduce((sum, container) => sum + container.componentCount, 0);
}
