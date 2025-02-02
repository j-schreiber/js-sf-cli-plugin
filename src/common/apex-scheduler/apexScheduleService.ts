import { EventEmitter } from 'node:events';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';
import { AsyncApexJob } from '../../types/scheduledApexTypes.js';
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
    const handler = new ScheduleSingleJobTask(this.targetOrgCon);
    handler.on('apexExecution', (result: ExecuteAnonymousResponse) => this.emitEvents(result));
    const startResult = await handler.start(inputs);
    return startResult;
  }

  public async stopJobs(inputs: ScheduledJobSearchOptions): Promise<StopScheduledApexResult[]> {
    const handler = new StopSingleJobTask(this.targetOrgCon);
    handler.on('apexExecution', (result: ExecuteAnonymousResponse) => this.emitEvents(result));
    const stopJobsQueue = new Array<Promise<StopScheduledApexResult>>();
    const idsToStop: string[] = [];
    if (inputs.ids && inputs.ids.length > 0) {
      inputs.ids.forEach((id) => idsToStop.push(id));
    }
    idsToStop.forEach((id) => {
      stopJobsQueue.push(handler.stop(id));
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
