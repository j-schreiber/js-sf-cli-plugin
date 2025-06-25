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
    { name: 'Id', type: 'id', filterable: true, custom: false } as Field,
    { name: 'Name', type: 'string', filterable: true, custom: false } as Field,
    { name: 'AccountNumber', type: 'string', filterable: true, custom: false } as Field,
    { name: 'CreatedDate', type: 'datetime', filterable: true, custom: false } as Field,
    { name: 'BillingStreet', type: 'textarea', filterable: true, custom: false } as Field,
    { name: 'LargeTextField__c', type: 'textarea', filterable: false, custom: true } as Field,
    { name: 'MyCustomField__c', type: 'string', filterable: true, custom: true } as Field,
  ],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Account',
  },
};

export default class FieldUsageTestContext {
  public coreContext: TestContext;
  public testTargetOrg: MockTestOrgData;
  public sobjectDescribe: Partial<DescribeSObjectResult>;
  public totalRecords: number;

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
    clearPluginCache();
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
      return Promise.resolve({ records: [{ expr0: this.totalRecords }], done: true });
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };
}

function clearPluginCache() {
  fs.rmSync('.jsc', { recursive: true, force: true });
}
