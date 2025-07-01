/* eslint-disable class-methods-use-this */
import fs from 'node:fs';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import { AnyJson, isObject, isString } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';

const MOCK_DESCRIBE_RESULT: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  name: 'Account',
  fields: [
    { name: 'Id', type: 'id', filterable: true, custom: false },
    { name: 'Name', type: 'string', filterable: true, custom: false },
    { name: 'AccountNumber', type: 'string', filterable: true, custom: false },
    { name: 'CreatedDate', type: 'datetime', filterable: true, custom: false },
    { name: 'BillingStreet', type: 'textarea', filterable: true, custom: false },
    { name: 'LargeTextField__c', type: 'textarea', filterable: false, custom: true },
    { name: 'MyCustomField__c', type: 'string', filterable: true, custom: true, defaultValue: 'Test' },
    { name: 'Formula__c', type: 'string', filterable: true, custom: true, calculated: true },
    { name: 'MyCheckbox__c', type: 'boolean', filterable: true, custom: true, defaultValue: true },
  ] as Field[],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Account',
  },
};

export default class FieldUsageTestContext {
  public coreContext: TestContext;
  public testTargetOrg: MockTestOrgData;
  public sobjectDescribe: Partial<DescribeSObjectResult>;
  public totalRecords: number;
  /** A map of explicit query strings and their expr0 result */
  public queryResults: Record<string, number> = {};

  public constructor() {
    this.coreContext = new TestContext();
    this.testTargetOrg = new MockTestOrgData();
    this.sobjectDescribe = structuredClone(MOCK_DESCRIBE_RESULT);
    this.totalRecords = 100;
  }

  public async init() {
    this.coreContext.fakeConnectionRequest = this.mockQueryResults;
  }

  public restore() {
    this.coreContext.restore();
    this.sobjectDescribe = structuredClone(MOCK_DESCRIBE_RESULT);
    this.totalRecords = 100;
    // plugin cache that stores describe results
    fs.rmSync('.jsc', { recursive: true, force: true });
  }

  public getFilterableFields(): number {
    let count = 0;
    // one field in our default describe result is non-filterable
    this.sobjectDescribe.fields?.forEach((field) => {
      if (field.filterable) {
        count++;
      }
    });
    return count;
  }

  public readonly mockDescribeFailure = (request: AnyJson): Promise<AnyJson> => {
    if (isString(request) && request.endsWith('/describe')) {
      return Promise.reject({ data: { errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' } });
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };

  public readonly mockQueryResults = (request: AnyJson): Promise<AnyJson> => {
    if (isString(request) && request.endsWith('/describe')) {
      const requestUrl = request.split('/');
      const sobjectName = requestUrl[requestUrl.length - 2];
      const describe = { ...this.sobjectDescribe, name: sobjectName };
      return Promise.resolve(describe as AnyJson);
    }
    if (isObject<{ method: string; url: string }>(request) && request.url.includes('COUNT(Id)')) {
      const queryParam = extractQueryParameter(request.url);
      if (queryParam && this.queryResults[queryParam] !== undefined) {
        return Promise.resolve({ records: [{ expr0: this.queryResults[queryParam] }], done: true });
      }
      return Promise.resolve({ records: [{ expr0: this.totalRecords }], done: true });
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };
}

function extractQueryParameter(fullRequestUrl: string): string | undefined {
  const rawQuery = fullRequestUrl.split('?q=')[1];
  return rawQuery ? decodeURIComponent(rawQuery) : undefined;
}
