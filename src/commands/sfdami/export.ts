import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Config } from '@oclif/core';
import MigrationPlanLoader from '../../common/migrationPlanLoader.js';
import ValidationResult from '../../common/validationResult.js';
import MigrationPlan from '../../common/migrationPlan.js';
import { eventBus } from '../../common/comms/eventBus.js';
import { PlanObjectEvent, PlanObjectValidationEvent, ProcessingStatus } from '../../common/comms/processingEvents.js';

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
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      char: 'd',
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      char: 'v',
    }),
  };

  public constructor(argv: string[], config: Config) {
    // Call the parent constructor with the required arguments
    super(argv, config);
    eventBus.on('planObjectEvent', (payload: PlanObjectEvent) => this.handleRecordRetrieveEvents(payload));
    eventBus.on('planValidationEvent', (payload: PlanObjectValidationEvent) =>
      this.handlePlanValidationEvents(payload)
    );
  }

  public async run(): Promise<SfdamiExportResult> {
    const { flags } = await this.parse(SfdamiExport);
    const plan = await MigrationPlanLoader.loadPlan(flags['plan'], flags['source-org']);
    this.validatePlan(plan);
    if (!flags['validate-only']) {
      await plan.execute(flags['output-dir']);
    }
    return {
      'source-org-id': flags['source-org'].getOrgId(),
      plan: flags['plan'],
    };
  }

  //    PRIVATE ZONE

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

  private handleRecordRetrieveEvents(payload: PlanObjectEvent): void {
    if (payload.status === ProcessingStatus.Started) {
      this.spinner.start(`Exporting ${payload.objectName}`);
    }
    if (payload.status === ProcessingStatus.InProgress) {
      this.spinner.status = `Completed ${payload.batchesCompleted} of ${payload.totalBatches} batches`;
    }
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop(`Retrieved ${payload.totalRecords} records in ${payload.files.length} files.`);
    }
  }

  private handlePlanValidationEvents(payload: PlanObjectValidationEvent): void {
    if (payload.status === ProcessingStatus.Started) {
      this.spinner.start(`Validating ${payload.planName}`);
    }
    if (payload.status === ProcessingStatus.InProgress) {
      this.spinner.status = payload.objectName;
    }
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop('Success!');
    }
  }
}
