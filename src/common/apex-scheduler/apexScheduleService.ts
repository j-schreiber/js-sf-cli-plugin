import { EventEmitter } from 'node:events';
import { ApexDiagnostic, ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';
import { AsyncApexJob } from '../../types/scheduledApexTypes.js';
import QueryRunner from '../utils/queryRunner.js';
import StopSingleJobTask from './stopSingleJobTask.js';

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
  ApexClass.Name,
  CronTriggerId,
  CronTrigger.CronJobDetail.Name,
  CronTrigger.State,
  CronTrigger.StartTime,
  CronTrigger.NextFireTime,
  CronTrigger.TimesTriggered
FROM AsyncApexJob`;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

export default class ApexScheduleService extends EventEmitter {
  private runner: QueryRunner;

  public constructor(private targetOrgCon: Connection) {
    super();
    this.runner = new QueryRunner(targetOrgCon);
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

  public async stopJobs(inputs: ScheduledJobSearchOptions): Promise<StopScheduledApexResult[]> {
    const apexExecutor = new StopSingleJobTask(this.targetOrgCon);
    const stopJobsQueue = new Array<Promise<StopScheduledApexResult>>();
    const idsToStop: string[] = [];
    if (inputs.ids && inputs.ids.length > 0) {
      inputs.ids.forEach((id) => idsToStop.push(id));
    }
    idsToStop.forEach((id) => {
      stopJobsQueue.push(apexExecutor.stop(id));
    });
    const stoppedJobs = await Promise.all(stopJobsQueue);
    return stoppedJobs;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async findJobs(filter: ScheduledJobSearchOptions): Promise<AsyncApexJob[]> {
    const jobs = await this.runner.fetchRecords<AsyncApexJob>(
      `${CRON_TRIGGER_SOQL_TEMPLATE} WHERE JobType = 'ScheduledApex' AND Status = 'Queued'`
    );
    // reduce array by apex class & job name filter
    // return filtered items
    return jobs;
  }

  private async retrieveJobDetails(jobId: string): Promise<AsyncApexJob> {
    const triggerDetails = await this.runner.fetchRecords<AsyncApexJob>(
      `${CRON_TRIGGER_SOQL_TEMPLATE} WHERE CronTriggerId = '${jobId}' LIMIT 1`
    );
    if (triggerDetails.length < 1) {
      throw messages.createError('FailedToRetrieveJobDetails', [jobId]);
    }
    return triggerDetails[0];
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
  assertCompileSuccess(result);
  if (isAsyncException(result.diagnostic)) {
    throw messages.createError('SystemAsyncException', [result.diagnostic![0].exceptionMessage]);
  } else if (isCronExpressionError(result.diagnostic)) {
    throw messages.createError('InvalidCronExpression', [
      inputs.cronExpression,
      result.diagnostic![0].exceptionMessage.substring(24),
    ]);
  }
  assertSuccess(result);
  const apexLog = result.logs!;
  const matchResult = /(DEBUG\|)([a-zA-Z0-9]{18})/.exec(apexLog);
  if (matchResult && matchResult.length >= 3) {
    return matchResult[2];
  } else {
    throw messages.createError('UnableToParseJobId');
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

export function assertCompileSuccess(result: ExecuteAnonymousResponse): void {
  if (!result.compiled) {
    const compileProblem = result.diagnostic?.[0].compileProblem ?? 'Unknown compile problem';
    throw messages.createError('GenericCompileFail', [compileProblem]);
  }
}

export function assertSuccess(result: ExecuteAnonymousResponse): void {
  if (!result.success) {
    const exceptionMessage = result.diagnostic?.[0].exceptionMessage ?? 'Unknown error';
    throw messages.createError('Unexpected', [exceptionMessage]);
  }
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

export type StopScheduledApexResult = {
  jobId: string;
  status: string;
};

export type ScheduledJobSearchOptions = {
  jobName?: string;
  apexClassName?: string;
  ids?: string[];
};
