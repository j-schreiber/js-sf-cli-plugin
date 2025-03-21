import fs from 'node:fs';
import path from 'node:path';
import { type AnyJson } from '@salesforce/ts-types';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { EmptyQueryResult } from '../data/api/queryResults.js';
import { MockAnyObjectResult } from '../data/describes/mockDescribeResults.js';

export function mockQueryResponseWithQueryMore(request: AnyJson): Promise<AnyJson> {
  const url = (request as { url: string }).url;
  if (url.includes('/query?')) {
    const orderBatch1 = JSON.parse(fs.readFileSync('./test/data/api/orders-1.json', 'utf-8')) as QueryResult<Record>;
    return Promise.resolve(orderBatch1);
  }
  if (url.includes('/query/0r8xx3d3FsAvwqKAIR-20')) {
    const orderBatch2 = JSON.parse(fs.readFileSync('./test/data/api/orders-2.json', 'utf-8')) as QueryResult<Record>;
    return Promise.resolve(orderBatch2);
  }
  return Promise.reject({ data: { message: 'Unexpected query was executed' } });
}

export function mockAnySObjectDescribe(request: AnyJson): Promise<AnyJson> {
  if (request?.toString().endsWith('/describe')) {
    const requestUrl = String(request).split('/');
    const sobjectName = requestUrl[requestUrl.length - 2];
    const describe = { ...MockAnyObjectResult, name: sobjectName };
    return Promise.resolve(describe as AnyJson);
  }
  const url = (request as { url: string }).url;
  if (url.includes('/query?')) {
    return Promise.resolve(EmptyQueryResult);
  }
  return Promise.resolve({});
}

export function parseFileAsQueryResult<T extends Record>(filePath: string[]) {
  return JSON.parse(fs.readFileSync(path.join(...filePath), 'utf8')) as QueryResult<T>;
}

export function parseFile<T>(filePath: string[]) {
  return JSON.parse(fs.readFileSync(path.join(...filePath), 'utf8')) as T;
}
