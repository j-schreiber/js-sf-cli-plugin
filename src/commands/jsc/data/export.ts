import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Config } from '@oclif/core';
import MigrationPlanLoader from '../../../common/migrationPlanLoader.js';
import { eventBus } from '../../../common/comms/eventBus.js';
import {
  PlanObjectEvent,
  PlanObjectValidationEvent,
  ProcessingStatus,
} from '../../../common/comms/processingEvents.js';
import { MigrationPlanObjectQueryResult } from '../../../types/migrationPlanObjectData.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.data.export');

export type JscDataExportResult = {
  'source-org-id': string;
  plan: string;
  exports?: MigrationPlanObjectQueryResult[];
};

export default class JscDataExport extends SfCommand<JscDataExportResult> {
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

  public async run(): Promise<JscDataExportResult> {
    const { flags } = await this.parse(JscDataExport);
    const plan = await MigrationPlanLoader.loadPlan(flags['plan'], flags['source-org']);
    let results;
    if (!flags['validate-only']) {
      results = await plan.execute(flags['output-dir']);
    }
    return {
      'source-org-id': flags['source-org'].getOrgId(),
      plan: flags['plan'],
      exports: results,
    };
  }

  //    PRIVATE ZONE

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
      this.spinner.start(`Validating ${payload.planName}`, payload.message);
    }
    this.spinner.status = payload.message;
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop('Success!');
    }
  }
}
