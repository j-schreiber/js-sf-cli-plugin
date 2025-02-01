import fs from 'node:fs';
import path from 'node:path';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { AsyncApexJob } from '../../src/types/scheduledApexTypes.js';

const testDataPath = path.join('test', 'data', 'apex-schedule-service');

export default class AnonymousApexMocks {
  public SUCCESS = parseMockResult<ExecuteAnonymousResponse>('success.json');
  public ALREADY_SCHEDULED_ERROR = parseMockResult<ExecuteAnonymousResponse>('is-already-scheduled-error.json');
  public INVALID_CRON_EXPRESSION_ERROR = parseMockResult<ExecuteAnonymousResponse>('invalid-cron-error.json');
  public JOB_DETAILS = parseMockResult<QueryResult<AsyncApexJob>>('cron-trigger-details.json');
  public ALL_JOBS = parseMockResult<QueryResult<AsyncApexJob>>('all-jobs.json');

  public queryStub = (soql: string): Promise<Record[]> => {
    if (soql.endsWith("FROM AsyncApexJob WHERE JobType IN ('BatchApexWorker','ScheduledApex') AND Status = 'Queued'")) {
      return Promise.resolve(this.ALL_JOBS.records);
    }
    if (soql.endsWith("FROM AsyncApexJob WHERE CronTriggerId = '08e9b00000KiFENAA3' LIMIT 1")) {
      return Promise.resolve(this.JOB_DETAILS.records);
    }
    return Promise.reject({ message: 'Unknown query. No SOQL stubbed', soql });
  };
}

export function parseMockResult<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(`${path.join(testDataPath, filePath)}`, 'utf8')) as T;
}
