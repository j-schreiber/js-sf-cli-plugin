import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';
import { manifestOutputDirFlag, outputFormatFlag, OutputFormats } from '../../../../common/jscSfCommandFlags.js';
import PackageManifestDirectory from '../../../../common/packageManifestDirectory.js';
import type { PackageGarbageResult } from '../../../../garbage-collection/types.js';
import {
  GarbageCollectionUx,
  GarbageCollector,
  resolveDevhub,
  resolvePackageIds,
} from '../../../../garbage-collection/index.js';
import { GarbageDisposer } from '../../../../garbage-disposal/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.collect');

export default class JscMaintainGarbageCollect extends SfCommand<PackageGarbageResult> {
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
    'output-dir': manifestOutputDirFlag,
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
    'output-format': outputFormatFlag(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<PackageGarbageResult> {
    const { flags } = await this.parse(JscMaintainGarbageCollect);
    const orgConnection = flags['target-org'].getConnection(flags['api-version']);
    const devhubConnection = resolveDevhub(flags['target-org'], flags['devhub-org'], flags['api-version']);
    const collector = GarbageCollector.newInstance(orgConnection, devhubConnection);
    collector.on('resolveMemberStatus', (payload: CommandStatusEvent) => {
      this.info(payload.message!);
    });
    const deprecatedPackageMembers = await collector.export({
      includeOnly: flags['metadata-type'],
      packages: await resolvePackageIds(orgConnection, (msg) => this.info(msg), flags.package),
    });
    this.writePackageXml(
      GarbageDisposer.newInstance(orgConnection),
      deprecatedPackageMembers,
      flags['output-dir'],
      flags['output-format']
    );
    new GarbageCollectionUx(this).printTable(deprecatedPackageMembers);
    process.exitCode = 0;
    return deprecatedPackageMembers;
  }

  private writePackageXml(
    disposer: GarbageDisposer,
    collectedGarbage: PackageGarbageResult,
    outputPath?: string,
    outputFormat?: OutputFormats
  ): void {
    if (outputPath === undefined) {
      return;
    }
    this.info(`Writing output to: ${outputPath}`);
    new PackageManifestDirectory(outputPath, outputFormat, disposer.manifestFrom(collectedGarbage)).write();
  }
}
