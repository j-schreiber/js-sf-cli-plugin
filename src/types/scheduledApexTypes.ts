export type AsyncApexJob = {
  Id: string;
  CronTriggerId: string;
  CronTrigger: CronTrigger;
  ApexClass: ApexClass;
};

export type CronTrigger = {
  State: string;
  StartTime: string;
  NextFireTime: string;
  CronJobDetail: CronJobDetail;
};

export type CronJobDetail = {
  Name: string;
};

export type ApexClass = {
  Name: string;
};
