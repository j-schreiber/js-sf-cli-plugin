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
  .strictObject(
    {
      stop_other_jobs: z.boolean().default(false),
    },
    { error: (issue) => (issue.code === 'unrecognized_keys' ? 'Valid options are: stop_other_jobs' : undefined) }
  )
  .prefault({});

const SingleScheduledJobConfig = z
  .object({ class: z.string().optional(), expression: z.string().nonempty('A valid cron expression is required') })
  .strict();

export const ScheduledJobConfig = z
  .object({
    options: ScheduledJobConfigOptions,
    jobs: z.record(z.string(), SingleScheduledJobConfig).default({}),
  })
  .strict();

export type ScheduledJobConfigType = z.infer<typeof ScheduledJobConfig>;
