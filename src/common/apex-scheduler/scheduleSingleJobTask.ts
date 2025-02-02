import { EventEmitter } from 'node:events';
import { ApexDiagnostic, ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import QueryRunner from '../utils/queryRunner.js';
import { AsyncApexJob } from '../../types/scheduledApexTypes.js';
import { assertCompileSuccess, assertSuccess, CRON_TRIGGER_SOQL_TEMPLATE } from './apexScheduleService.js';

const JOB_NAME_PLACEHOLDER = '%%%JOB_NAME%%%';
const CLASS_NAME_PLACEHOLDER = '%%%APEX_CLASS_NAME%%%';
const CRON_EXPRESSION_PLACEHOLDER = '%%%CRON_EXPRESSION%%%';

const SCHEDULE_SINGLE_CLASS_TEMPLATE = `String jobName = '${JOB_NAME_PLACEHOLDER}';
String cronExpression = '${CRON_EXPRESSION_PLACEHOLDER}';
Id jobId = System.schedule(jobName, cronExpression, new ${CLASS_NAME_PLACEHOLDER}());
System.debug(jobId);`;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

export default class ScheduleSingleJobTask extends EventEmitter {
  private executor: ExecuteService;
  private runner: QueryRunner;

  public constructor(private targetOrgCon: Connection) {
    super();
    this.executor = new ExecuteService(this.targetOrgCon);
    this.runner = new QueryRunner(targetOrgCon);
  }

  public async start(inputs: ApexScheduleOptions): Promise<ScheduleApexResult> {
    const apexCode = prepareApexTemplate(inputs);
    const result = await this.executor.executeAnonymous({ apexCode });
    this.emit('apexExecution', result);
    const jobId = parseAnonymousApexResult(result, inputs);
    const jobDetails = await this.retrieveJobDetails(jobId);
    return { jobId, nextFireTime: new Date(jobDetails.CronTrigger.NextFireTime) };
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

export type ApexScheduleOptions = {
  jobName?: string;
  apexClassName: string;
  cronExpression: string;
};

export type ScheduleApexResult = {
  jobId: string;
  nextFireTime: Date;
};
