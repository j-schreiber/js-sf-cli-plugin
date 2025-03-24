/* eslint-disable camelcase */
import { z } from 'zod';

export type AsyncApexJob = {
  Id: string;
  CronTriggerId: string;
  CronTrigger: CronTrigger;
  ApexClass: ApexClass;
};

export type AsyncApexJobFlat = {
  CronTriggerId: string;
  ApexClassName: string;
  CronTriggerState: string;
  NextFireTime: Date;
  StartTime: Date;
  CronJobDetailName: string;
  TimesTriggered: number;
  CronExpression?: string;
};

export type CronTrigger = {
  State: string;
  StartTime: string;
  NextFireTime: string;
  CronJobDetail: CronJobDetail;
  TimesTriggered: number;
  CronExpression?: string;
};

export type CronJobDetail = {
  Name: string;
};

export type ApexClass = {
  Name: string;
};

const ScheduledJobConfigOptions = z
  .object({
    restart_all_jobs: z.boolean().default(false),
    stop_other_jobs: z.boolean().default(false),
  })
  .strict('Valid options are: restart_all_jobs, stop_other_jobs')
  .default({});

const SingleScheduledJobConfig = z.object({ class: z.string().optional(), expression: z.string() });

export const ScheduledJobConfig = z
  .object({
    options: ScheduledJobConfigOptions,
    jobs: z.record(SingleScheduledJobConfig).default({}),
  })
  .strict();

export type ScheduledJobConfigType = z.infer<typeof ScheduledJobConfig>;
