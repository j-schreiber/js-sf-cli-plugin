import fs from 'node:fs';
import { type AnyJson } from '@salesforce/ts-types';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { EmptyQueryResult } from '../data/api/queryResults.js';

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
    return Promise.resolve({
      custom: true,
      createable: true,
      name: sobjectName,
      fields: [{ name: 'Id' }, { name: 'Name' }],
      urls: {
        sobject: `/services/data/v60.0/sobjects/${sobjectName}`,
      },
    });
  }
  const url = (request as { url: string }).url;
  if (url.includes('/query?')) {
    return Promise.resolve(EmptyQueryResult);
  }
  return Promise.resolve({});
}
