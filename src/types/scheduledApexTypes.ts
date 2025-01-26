export type AsyncApexJob = {
  Id: string;
  CronTrigger: CronTrigger;
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
