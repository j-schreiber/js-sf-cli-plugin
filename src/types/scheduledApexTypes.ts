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
