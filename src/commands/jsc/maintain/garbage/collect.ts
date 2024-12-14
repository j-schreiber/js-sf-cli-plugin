import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.collect');

export type JscMaintainGarbageCollectResult = {
  path: string;
};

export default class JscMaintainGarbageCollect extends SfCommand<JscMaintainGarbageCollectResult> {
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
      char: 't',
      required: true,
    }),
  };

  public async run(): Promise<JscMaintainGarbageCollectResult> {
    const { flags } = await this.parse(JscMaintainGarbageCollect);
    this.info(`Package: ${flags.package!}`);
    this.info(flags['target-org'].getUsername()!);
    process.exitCode = 0;
    return {
      path: 'src/commands/jsc/maintain/garbage/collect.ts',
    };
  }
}
