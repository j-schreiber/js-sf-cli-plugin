import { EventEmitter } from 'node:events';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';
import { AsyncApexJob, AsyncApexJobFlat } from '../../types/scheduledApexTypes.js';
import QueryRunner from '../utils/queryRunner.js';
import StopSingleJobTask, { StopScheduledApexResult } from './stopSingleJobTask.js';
import ScheduleSingleJobTask, { ApexScheduleOptions, ScheduleApexResult } from './scheduleSingleJobTask.js';

export const CRON_TRIGGER_SOQL_TEMPLATE = `SELECT 
  Id,
  Status,
  ApexClass.Name,
  CronTriggerId,
  CronTrigger.CronJobDetail.Name,
  CronTrigger.State,
  CronTrigger.StartTime,
  CronTrigger.NextFireTime,
  CronTrigger.TimesTriggered,
  CronTrigger.CronExpression
FROM AsyncApexJob`;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

export default class ApexScheduleService extends EventEmitter {
  private readonly runner: QueryRunner;

  public constructor(private readonly targetOrgCon: Connection) {
    super();
    this.runner = new QueryRunner(targetOrgCon);
  }

  public async scheduleJob(inputs: ApexScheduleOptions): Promise<ScheduleApexResult> {
    const handler = new ScheduleSingleJobTask(this.targetOrgCon);
    handler.on('apexExecution', (result: ExecuteAnonymousResponse) => this.emitEvents(result));
    const startResult = await handler.start(inputs);
    return startResult;
  }

  public async stopJobs(jobIds: string[]): Promise<StopScheduledApexResult[]> {
    const handler = new StopSingleJobTask(this.targetOrgCon);
    handler.on('apexExecution', (result: ExecuteAnonymousResponse) => this.emitEvents(result));
    const stopJobsQueue = new Array<Promise<StopScheduledApexResult>>();
    jobIds.forEach((id) => {
      stopJobsQueue.push(handler.stop(id));
    });
    const stoppedJobs = await Promise.all(stopJobsQueue);
    return stoppedJobs;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async findJobs(filterCriteria: ScheduledJobSearchOptions): Promise<AsyncApexJobFlat[]> {
    const filter = new ScheduledJobFilter(filterCriteria);
    const jobs = await this.runner.fetchRecords<AsyncApexJob>(
      `${CRON_TRIGGER_SOQL_TEMPLATE} WHERE JobType = 'ScheduledApex' AND Status = 'Queued'`
    );
    const jobsOutput = new Array<AsyncApexJobFlat>();
    jobs.forEach((job) => {
      const output = {
        CronTriggerId: job.CronTriggerId,
        ApexClassName: job.ApexClass.Name,
        CronTriggerState: job.CronTrigger.State,
        NextFireTime: new Date(job.CronTrigger.NextFireTime),
        StartTime: new Date(job.CronTrigger.StartTime),
        CronJobDetailName: job.CronTrigger.CronJobDetail.Name,
        TimesTriggered: job.CronTrigger.TimesTriggered,
        CronExpression: job.CronTrigger.CronExpression,
      };
      if (filter.satisfiesCriteria(output)) {
        jobsOutput.push(output);
      }
    });
    return jobsOutput;
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

export type ScheduledJobSearchOptions = {
  jobName?: string;
  apexClassName?: string;
  ids?: string[];
};

class ScheduledJobFilter {
  public constructor(private readonly criteria: ScheduledJobSearchOptions) {}

  public satisfiesCriteria(job: AsyncApexJobFlat): boolean {
    return (
      this.matchesClassNameFilter(job.ApexClassName) &&
      this.matchesJobName(job.CronJobDetailName) &&
      this.matchesIdFilter(job.CronTriggerId)
    );
  }

  private matchesClassNameFilter(apexClassName: string): boolean {
    if (this.criteria.apexClassName) {
      return this.criteria.apexClassName === apexClassName;
    }
    return true;
  }

  private matchesJobName(jobName: string): boolean {
    if (this.criteria.jobName) {
      return jobName.startsWith(this.criteria.jobName);
    }
    return true;
  }

  private matchesIdFilter(cronTriggerId: string): boolean {
    if (this.criteria.ids) {
      return this.criteria.ids.includes(cronTriggerId);
    }
    return true;
  }
}
