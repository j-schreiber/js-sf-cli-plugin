import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import GarbageCollector from '../../../../garbage-collection/garbageCollector.js';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';
import { PackageGarbageResult } from '../../../../garbage-collection/packageGarbage.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.collect');

// export type JscMaintainGarbageCollectResult = {
//   deprecatedMembers: PackageGar;
// };

export default class JscMaintainGarbageCollect extends SfCommand<PackageGarbageResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      required: false,
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<PackageGarbageResult> {
    const { flags } = await this.parse(JscMaintainGarbageCollect);
    const collector = GarbageCollector.newInstance(flags['target-org'].getConnection(flags['api-version']));
    collector.on('resolveMemberStatus', (payload: CommandStatusEvent) => {
      this.info(payload.message!);
    });
    const deprecatedPackageMembers = await collector.export();
    process.exitCode = 0;
    return deprecatedPackageMembers;
  }
}
