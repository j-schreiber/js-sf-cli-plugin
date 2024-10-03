import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import MigrationPlanLoader from '../../../common/migrationPlanLoader.js';

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
    'rebuild-cache': Flags.boolean({
      summary: messages.getMessage('flags.rebuild-cache.summary'),
      char: 'r',
    }),
    plan: Flags.file({
      summary: messages.getMessage('flags.plan.summary'),
      char: 'p',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<IndexBuildResult> {
    const { flags } = await this.parse(IndexBuild);
    const plan = await MigrationPlanLoader.loadPlan(flags.plan, flags['target-org']);
    this.log(`${plan.getName()}`);
    return {
      isSuccess: true,
    };
  }
}
