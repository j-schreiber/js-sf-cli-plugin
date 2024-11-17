import { Config } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { eventBus } from '../../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../common/comms/processingEvents.js';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import { JscManifestRolloutResult } from './rollout.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const valMessages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.manifest.validate');
const rolloutMessages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.manifest.rollout');

export default class JscManifestValidate extends SfCommand<JscManifestRolloutResult> {
  public static readonly summary = valMessages.getMessage('summary');
  public static readonly description = valMessages.getMessage('description');
  public static readonly examples = valMessages.getMessages('examples');

  public static readonly flags = {
    manifest: Flags.file({
      summary: rolloutMessages.getMessage('flags.manifest.summary'),
      char: 'm',
      required: true,
      exists: true,
    }),
    'target-org': Flags.requiredOrg({
      summary: rolloutMessages.getMessage('flags.target-org.summary'),
      char: 't',
      required: true,
    }),
    'devhub-org': Flags.requiredOrg({
      summary: rolloutMessages.getMessage('flags.devhub-org.summary'),
      char: 'o',
      required: true,
    }),
  };

  public constructor(argv: string[], config: Config) {
    super(argv, config);
    eventBus.on('manifestRollout', (payload: CommandStatusEvent) => this.handleStatusEvent(payload));
    eventBus.on('simpleMessage', (payload: CommandStatusEvent) => this.log(payload.message));
  }

  public async run(): Promise<JscManifestRolloutResult> {
    const { flags } = await this.parse(JscManifestValidate);
    this.info(rolloutMessages.getMessage('infos.target-org-info', [flags['target-org'].getUsername()]));
    this.info(rolloutMessages.getMessage('infos.devhub-org-info', [flags['devhub-org'].getUsername()]));
    const manifest = ReleaseManifestLoader.load(flags.manifest);
    const resolveResults = await manifest.resolve(
      flags['target-org'].getConnection('60.0'),
      flags['devhub-org'].getConnection('60.0')
    );
    return {
      targetOrgUsername: flags['target-org'].getUsername(),
      devhubOrgUsername: flags['devhub-org'].getUsername(),
      deployedArtifacts: resolveResults,
    };
  }

  private handleStatusEvent(payload: CommandStatusEvent): void {
    if (payload.status === ProcessingStatus.Started) {
      this.spinner.start(payload.message!);
    }
    this.spinner.status = payload.message;
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop(payload.message);
    }
  }
}
