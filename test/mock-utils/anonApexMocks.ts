import fs from 'node:fs';
import path from 'node:path';
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';

const testDataPath = path.join('test', 'data', 'anon-apex');

export default class AnonymousApexMocks {
  public SUCCESS = parseMockResult<ExecuteAnonymousResponse>('success.json');
}

export function parseMockResult<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(`${path.join(testDataPath, filePath)}`, 'utf8')) as T;
}
