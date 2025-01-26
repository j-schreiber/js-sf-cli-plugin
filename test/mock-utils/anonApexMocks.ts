import fs from 'node:fs';
import path from 'node:path';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { QueryResult } from '@jsforce/jsforce-node';
import { AsyncApexJob } from '../../src/types/scheduledApexTypes.js';

const testDataPath = path.join('test', 'data', 'apex-schedule-service');

export default class AnonymousApexMocks {
  public SUCCESS = parseMockResult<ExecuteAnonymousResponse>('success.json');
  public ALREADY_SCHEDULED_ERROR = parseMockResult<ExecuteAnonymousResponse>('is-already-scheduled-error.json');
  public INVALID_CRON_EXPRESSION_ERROR = parseMockResult<ExecuteAnonymousResponse>('invalid-cron-error.json');
  public JOB_DETAILS = parseMockResult<QueryResult<AsyncApexJob>>('cron-trigger-details.json');
}

export function parseMockResult<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(`${path.join(testDataPath, filePath)}`, 'utf8')) as T;
}
