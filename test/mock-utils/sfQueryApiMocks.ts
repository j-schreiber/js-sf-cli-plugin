import fs from 'node:fs';
import { type AnyJson } from '@salesforce/ts-types';
import { QueryResult, Record } from '@jsforce/jsforce-node';

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
