import { EventEmitter } from 'node:events';
import { ApexDiagnostic, ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';
import { AsyncApexJob } from '../../types/scheduledApexTypes.js';

const JOB_NAME_PLACEHOLDER = '%%%JOB_NAME%%%';
const CLASS_NAME_PLACEHOLDER = '%%%APEX_CLASS_NAME%%%';
const CRON_EXPRESSION_PLACEHOLDER = '%%%CRON_EXPRESSION%%%';

const SCHEDULE_SINGLE_CLASS_TEMPLATE = `String jobName = '${JOB_NAME_PLACEHOLDER}';
String cronExpression = '${CRON_EXPRESSION_PLACEHOLDER}';
Id jobId = System.schedule(jobName, cronExpression, new ${CLASS_NAME_PLACEHOLDER}());
System.debug(jobId);`;

const CRON_TRIGGER_SOQL_TEMPLATE = `SELECT 
  Id,
  Status,
  CronTrigger.CronJobDetail.Name,
  CronTrigger.State,
  CronTrigger.StartTime,
  CronTrigger.NextFireTime
FROM AsyncApexJob`;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

export default class ApexScheduleService extends EventEmitter {
  public constructor(private targetOrgCon: Connection) {
    super();
  }

  public async scheduleJob(inputs: ApexScheduleOptions): Promise<ScheduleApexResult> {
    const apexCode = prepareApexTemplate(inputs);
    const apexExecutor = new ExecuteService(this.targetOrgCon);
    const result = await apexExecutor.executeAnonymous({ apexCode });
    this.emitEvents(result);
    const jobId = parseAnonymousApexResult(result, inputs);
    const jobDetails = await this.retrieveJobDetails(jobId);
    return { jobId, nextFireTime: new Date(jobDetails.CronTrigger.NextFireTime) };
  }

  private async retrieveJobDetails(jobId: string): Promise<AsyncApexJob> {
    const triggerDetails = await this.targetOrgCon.query<AsyncApexJob>(
      `${CRON_TRIGGER_SOQL_TEMPLATE} WHERE CronTriggerId = '${jobId}' LIMIT 1`
    );
    if (triggerDetails.records.length < 1) {
      throw messages.createError('FailedToRetrieveJobDetails', [jobId]);
    }
    return triggerDetails.records[0];
  }

  private emitEvents(result: ExecuteAnonymousResponse): void {
    this.emit('logOutput', {
      message: result.logs,
      status: ProcessingStatus.InProgress,
    } as CommandStatusEvent);
    if (result.diagnostic) {
      this.emit('diagnostics', {
        message: JSON.stringify(result.diagnostic, null, 2),
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
    }
  }
}

function prepareApexTemplate(inputs: ApexScheduleOptions): string {
  let apexCode = SCHEDULE_SINGLE_CLASS_TEMPLATE;
  apexCode = apexCode.replace(JOB_NAME_PLACEHOLDER, inputs.jobName ?? inputs.apexClassName);
  apexCode = apexCode.replace(CLASS_NAME_PLACEHOLDER, inputs.apexClassName);
  apexCode = apexCode.replace(CRON_EXPRESSION_PLACEHOLDER, inputs.cronExpression);
  return apexCode;
}

function parseAnonymousApexResult(result: ExecuteAnonymousResponse, inputs: ApexScheduleOptions): string {
  if (!result.compiled) {
    const compileProblem = result.diagnostic?.[0].compileProblem ?? 'Unknown compile problem';
    throw messages.createError('GenericCompileFail', [compileProblem]);
  }
  if (result.success) {
    const apexLog = result.logs!;
    const matchResult = /(DEBUG\|)([a-zA-Z0-9]{18})/.exec(apexLog);
    if (matchResult && matchResult.length >= 3) {
      return matchResult[2];
    } else {
      throw messages.createError('UnableToParseJobId');
    }
  } else if (isAsyncException(result.diagnostic)) {
    throw messages.createError('SystemAsyncException', [result.diagnostic![0].exceptionMessage]);
  } else if (isCronExpressionError(result.diagnostic)) {
    throw messages.createError('InvalidCronExpression', [
      inputs.cronExpression,
      result.diagnostic![0].exceptionMessage.substring(24),
    ]);
  } else {
    const exceptionMessage = result.diagnostic?.[0].exceptionMessage ?? 'Unknown error';
    throw messages.createError('Unexpected', [exceptionMessage]);
  }
}

function isAsyncException(diagnostics?: ApexDiagnostic[]): boolean {
  return (
    diagnostics !== undefined &&
    diagnostics.length >= 1 &&
    diagnostics[0].exceptionMessage.startsWith('System.AsyncException')
  );
}

function isCronExpressionError(diagnostics?: ApexDiagnostic[]): boolean {
  return (
    diagnostics !== undefined &&
    diagnostics.length >= 1 &&
    Number(diagnostics[0].lineNumber) === 3 &&
    diagnostics[0].exceptionMessage.startsWith('System.StringException')
  );
}

export type ApexScheduleOptions = {
  jobName?: string;
  apexClassName: string;
  cronExpression: string;
};

export type ScheduleApexResult = {
  jobId: string;
  nextFireTime: Date;
};
