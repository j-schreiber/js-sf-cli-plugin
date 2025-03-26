import { EventEmitter } from 'node:events';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { Connection, Messages, SfError } from '@salesforce/core';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';
import { AsyncApexJob, AsyncApexJobFlat, ScheduledJobConfigType } from '../../types/scheduledApexTypes.js';
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

  /**
   * Starts an scheduled job on the target org with apex class name
   * and cron expression.
   *
   * @param inputs
   * @returns
   */
  public async scheduleJob(inputs: ApexScheduleOptions): Promise<ScheduleApexResult> {
    const handler = new ScheduleSingleJobTask(this.targetOrgCon);
    handler.on('apexExecution', (result: ExecuteAnonymousResponse) => this.emitEvents(result));
    const startResult = await handler.start(inputs);
    return startResult;
  }

  /**
   * Stops a one or more scheduled jobs by their CronTriggerId.
   *
   * @param jobIds
   * @returns
   */
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

  /**
   * Exports running scheduled jobs, filtered by cron trigger id, apex class or
   * (partial) job detail name.
   *
   * @param filterCriteria
   * @returns
   */
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

  /**
   * Reads a jobs config (parsed from config file or org manifest)
   * and identifies which jobs to start or stop.
   *
   * @param jobsConfig
   * @returns
   */
  public async manageJobs(jobsConfig: ScheduledJobConfigType, simulateOnly?: boolean): Promise<ManageJobsResult> {
    try {
      const runningJobs = await this.findJobs({});
      const jobsToStop = filterJobsToStop(jobsConfig, runningJobs);
      if (jobsToStop.length > 0 && !simulateOnly) {
        await this.stopJobs(jobsToStop.map((job) => job.CronTriggerId));
      }
      const jobsToStart = filterJobsToStart(jobsConfig, runningJobs);
      const startResults = new Array<Partial<ScheduleApexResult>>();
      if (jobsToStart.length > 0) {
        startResults.push(...(await this.startAllJobs(jobsToStart, simulateOnly)));
      }
      const untouched = runningJobs.filter(
        (runningJob) => !jobsToStop.find((toStop) => toStop.CronTriggerId === runningJob.CronTriggerId)
      );
      return { started: startResults, stopped: jobsToStop, untouched };
    } catch (err) {
      throw messages.createError('JobManagementFailure', [readSfErrorDetails(err)]);
    }
  }

  //    PRIVATE ZONE

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

  private async startAllJobs(
    jobInputs: ApexScheduleOptions[],
    simulateOnly?: boolean
  ): Promise<Array<Partial<ScheduleApexResult>>> {
    if (simulateOnly) {
      return jobInputs;
    }
    const schedulePromises = new Array<Promise<ScheduleApexResult>>();
    jobInputs.forEach((startJob) => schedulePromises.push(this.scheduleJob(startJob)));
    const startResults = await Promise.all(schedulePromises);
    return startResults;
  }
}

function buildJobStartInputs(jobsConfig: ScheduledJobConfigType): ApexScheduleOptions[] {
  const result = new Array<ApexScheduleOptions>();
  for (const [jobName, jobDefinition] of Object.entries(jobsConfig.jobs)) {
    result.push({
      apexClassName: jobDefinition.class ?? jobName,
      cronExpression: jobDefinition.expression,
      jobName,
    });
  }
  return result;
}

function filterJobsToStart(jobsConfig: ScheduledJobConfigType, runningJobs: AsyncApexJobFlat[]): ApexScheduleOptions[] {
  const initialOpts = buildJobStartInputs(jobsConfig);
  return initialOpts.filter(
    (startConfig) => !runningJobs.find((runningJob) => scheduleConfigMatchesExisting(startConfig, runningJob))
  );
}

function filterJobsToStop(jobsConfig: ScheduledJobConfigType, runningJobs: AsyncApexJobFlat[]): AsyncApexJobFlat[] {
  const initialOpts = buildJobStartInputs(jobsConfig);
  const jobsToStop = new Array<AsyncApexJobFlat>();
  if (jobsConfig.options.stop_other_jobs) {
    runningJobs.forEach((job) => {
      const matchingNewConfig = initialOpts.find((startConfig) => scheduleConfigMatchesExisting(startConfig, job));
      if (matchingNewConfig === undefined) {
        jobsToStop.push(job);
      }
    });
  } else {
    runningJobs.forEach((job) => {
      const conflictingConfig = initialOpts.find((startConfig) => scheduleConfigMatchesPartial(startConfig, job));
      if (conflictingConfig) {
        jobsToStop.push(job);
      }
    });
  }
  return jobsToStop;
}

function scheduleConfigMatchesExisting(config: ApexScheduleOptions, existingJob: AsyncApexJobFlat): boolean {
  return (
    config.apexClassName === existingJob.ApexClassName &&
    config.jobName === existingJob.CronJobDetailName &&
    config.cronExpression === existingJob.CronExpression
  );
}

function scheduleConfigMatchesPartial(config: ApexScheduleOptions, existingJob: AsyncApexJobFlat): boolean {
  return (
    config.apexClassName === existingJob.ApexClassName &&
    config.jobName === existingJob.CronJobDetailName &&
    config.cronExpression !== existingJob.CronExpression
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

export function readSfErrorDetails(err: unknown): string {
  if (err instanceof SfError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.name;
  }
  return 'Unknown';
}

export type ScheduledJobSearchOptions = {
  jobName?: string;
  apexClassName?: string;
  ids?: string[];
};

export type ManageJobsResult = {
  started: Array<Partial<ScheduleApexResult>>;
  stopped: AsyncApexJobFlat[];
  untouched: AsyncApexJobFlat[];
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
