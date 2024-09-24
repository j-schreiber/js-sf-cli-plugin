import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sfdami', 'sfdami.index.build');

export type IndexBuildResult = {
  isSuccess: boolean;
};

export default class IndexBuild extends SfCommand<IndexBuildResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
  };

  public async run(): Promise<IndexBuildResult> {
    const { flags } = await this.parse(IndexBuild);
    this.log(flags['target-org'].getOrgId());
    return {
      isSuccess: true,
    };
  }
}
