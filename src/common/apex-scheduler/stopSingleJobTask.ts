import { ApexDiagnostic, ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import { Connection, Messages } from '@salesforce/core';
import { assertCompileSuccess, assertSuccess } from './apexScheduleService.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'apexscheduler');

const JOB_ID_PLACEHOLDER = '%%%JOB_ID%%%';
const STOP_SINGLE_JOB_TEMPLATE = `System.abortJob('${JOB_ID_PLACEHOLDER}');`;

export default class StopSingleJobTask {
  private executor: ExecuteService;

  public constructor(private targetOrgCon: Connection) {
    this.executor = new ExecuteService(this.targetOrgCon);
  }

  public async stop(id: string): Promise<StopScheduledApexResult> {
    const apexCode = prepareCode(id);
    const anonResult = await this.executor.executeAnonymous({ apexCode });
    return { jobId: id, status: parseExecutionResult(anonResult) };
  }
}

function parseExecutionResult(result: ExecuteAnonymousResponse): string {
  // console.log(JSON.stringify(result));
  assertCompileSuccess(result);
  if (isAlreadyAborted(result.diagnostic)) {
    throw messages.createError('JobAlreadyAborted', [result.diagnostic![0].exceptionMessage.substring(24)]);
  }
  assertSuccess(result);
  return 'STOPPED';
}

function prepareCode(jobId: string): string {
  let apexCode = STOP_SINGLE_JOB_TEMPLATE;
  apexCode = apexCode.replace(JOB_ID_PLACEHOLDER, jobId);
  return apexCode;
}

function isAlreadyAborted(diagnostics?: ApexDiagnostic[]): boolean {
  return (
    diagnostics !== undefined &&
    diagnostics.length >= 1 &&
    diagnostics[0].exceptionMessage.endsWith('Job does not exist or is already aborted.')
  );
}

export type StopScheduledApexResult = {
  jobId: string;
  status: string;
};
