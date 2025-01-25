import { ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';

const JOB_NAME_PLACEHOLDER = '%%%JOB_NAME%%%';
const CLASS_NAME_PLACEHOLDER = '%%%APEX_CLASS_NAME%%%';
const CRON_EXPRESSION_PLACEHOLDER = '%%%CRON_EXPRESSION%%%';

const SCHEDULE_SINGLE_CLASS_TEMPLATE = `
  String jobName = '${JOB_NAME_PLACEHOLDER}';
  String cronExpression = '${CRON_EXPRESSION_PLACEHOLDER}';
  Id jobId = System.schedule(jobName, cronExpression, new ${CLASS_NAME_PLACEHOLDER}());
  System.debug('%%%JOB_ID%%%=' + jobId);
`;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

export default class ApexScheduleService {
  public constructor(private targetOrgCon: Connection) {}

  public async scheduleJob(inputs: ApexScheduleOptions): Promise<ScheduleApexResult> {
    // use inputs.option to use different templates
    // e.g. when a class should only be scheduled, when it is not yet scheduled
    // allow array of class names? Then allow option to "abort all other"
    const apexCode = prepareApexTemplate(inputs);
    const apexExecutor = new ExecuteService(this.targetOrgCon);
    const result = await apexExecutor.executeAnonymous({ apexCode });
    const jobId = parseAnonymousApexResult(result);
    // extract job id from debug log
    return Promise.resolve({ jobId });
  }
}

function prepareApexTemplate(inputs: ApexScheduleOptions): string {
  let apexCode = SCHEDULE_SINGLE_CLASS_TEMPLATE;
  apexCode = apexCode.replace(JOB_NAME_PLACEHOLDER, inputs.jobName ?? inputs.apexClassName);
  apexCode = apexCode.replace(CLASS_NAME_PLACEHOLDER, inputs.apexClassName);
  apexCode = apexCode.replace(CRON_EXPRESSION_PLACEHOLDER, inputs.cronExpression);
  return apexCode;
}

function parseAnonymousApexResult(result: ExecuteAnonymousResponse): string {
  // console.log(JSON.stringify(result));
  if (!result.compiled) {
    const compileProblem = result.diagnostic?.[0].compileProblem ?? 'Unknown compile problem';
    throw messages.createError('GenericCompileFail', [compileProblem]);
  }
  if (result.success) {
    const apexLog = result.logs!;
    const matchResult = /(DEBUG\|%%%JOB_ID%%%=)([a-zA-Z0-9]{18})/.exec(apexLog);
    if (matchResult && matchResult.length >= 3) {
      return matchResult[2];
    } else {
      throw messages.createError('UnableToParseJobId');
    }
  } else {
    const exceptionMessage = result.diagnostic?.[0].exceptionMessage ?? '';
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
};
