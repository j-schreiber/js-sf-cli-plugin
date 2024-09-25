import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import MigrationPlanLoader from '../../common/migrationPlanLoader.js';
import ValidationResult from '../../common/validationResult.js';
import MigrationPlan from '../../common/migrationPlan.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sfdami', 'sfdami.export');

export type SfdamiExportResult = {
  'source-org-id': string;
  plan: string;
};

export default class SfdamiExport extends SfCommand<SfdamiExportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.source-org.summary'),
      char: 'o',
      required: true,
    }),
    plan: Flags.file({
      summary: messages.getMessage('flags.plan.summary'),
      char: 'p',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<SfdamiExportResult> {
    const { flags } = await this.parse(SfdamiExport);
    const plan = MigrationPlanLoader.loadPlan(flags['plan']);
    this.validatePlan(plan);
    return {
      'source-org-id': flags['source-org'].getOrgId(),
      plan: flags['plan'],
    };
  }

  private validatePlan(plan: MigrationPlan): void {
    const planValResult: ValidationResult = plan.selfCheck();
    if (planValResult.isValid()) {
      this.log('Plan successfully initialised.');
    } else {
      planValResult.errors.forEach((errMsg) => {
        this.error(errMsg);
      });
    }
  }
}
