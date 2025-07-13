/* eslint-disable class-methods-use-this */
import fs from 'node:fs';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import { AnyJson, isObject, isString } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';

const MOCK_DESCRIBE_RESULT_TEMPLATE = {
  custom: false,
  createable: true,
  name: 'Account',
  childRelationships: [
    {
      cascadeDelete: false,
      childSObject: 'Case',
      deprecatedAndHidden: false,
      field: 'AccountId',
      junctionIdListNames: [],
      junctionReferenceTo: [],
      relationshipName: 'Cases',
      restrictedDelete: false,
    },
    {
      cascadeDelete: true,
      childSObject: 'AccountHistory',
      deprecatedAndHidden: false,
      field: 'AccountId',
      junctionIdListNames: [],
      junctionReferenceTo: [],
      relationshipName: 'Histories',
      restrictedDelete: false,
    },
  ],
  fields: [
    { name: 'Id', type: 'id', filterable: true, custom: false },
    { name: 'Name', type: 'string', filterable: true, custom: false },
    { name: 'AccountNumber', type: 'string', filterable: true, custom: false },
    { name: 'CreatedDate', type: 'datetime', filterable: true, custom: false },
    { name: 'BillingStreet', type: 'textarea', filterable: true, custom: false },
    { name: 'RecordTypeId', type: 'reference', filterable: true, custom: false },
    { name: 'LargeTextField__c', type: 'textarea', filterable: false, custom: true },
    { name: 'MyCustomField__c', type: 'string', filterable: true, custom: true, defaultValue: 'Test' },
    { name: 'Formula__c', type: 'string', filterable: true, custom: true, calculated: true },
    { name: 'MyCheckbox__c', type: 'boolean', filterable: true, custom: true, defaultValue: true },
  ] as Field[],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Account',
  },
};

const HISTORY_DESCRIBE_RESULT_TEMPLATE = {
  custom: false,
  createable: false,
  name: 'AccountHistory',
  associateEntityType: 'History',
  associateParentEntity: 'Account',
  fields: [
    { name: 'AccountId', type: 'reference', filterable: true, custom: false, relationshipName: 'Account' },
    { name: 'Field', type: 'picklist', filterable: true, custom: false },
  ] as Field[],
};

export default class FieldUsageTestContext {
  public coreContext: TestContext;
  public testTargetOrg: MockTestOrgData;
  public totalRecords: number;
  /** A map of explicit query strings and their "totalSize" result to mock populated fields count */
  public queryResults: Record<string, number> = {};
  /** Map of field names and their aggregate results to mock field history analysis */
  public fieldHistoryMocks: Record<string, { expr0: number; expr1: string }> = {};
  /** A key/value map of mocked describe results. Use sobject developer name for keys */
  public describes: Record<string, Partial<DescribeSObjectResult>> = {};

  public constructor() {
    this.coreContext = new TestContext();
    this.testTargetOrg = new MockTestOrgData();
    this.totalRecords = 100;
    this.describes['Account'] = this.cloneDescribeMock('Account');
    this.describes['Order'] = this.cloneDescribeMock('Order');
    this.describes['AccountHistory'] = structuredClone(HISTORY_DESCRIBE_RESULT_TEMPLATE);
    this.setFieldHistoryMocksForAllFields('Account');
  }

  public async init() {
    this.coreContext.fakeConnectionRequest = this.mockQueryResults;
  }

  public restore() {
    this.coreContext.restore();
    this.describes['Account'] = this.cloneDescribeMock('Account');
    this.describes['Order'] = this.cloneDescribeMock('Order');
    this.describes['AccountHistory'] = structuredClone(HISTORY_DESCRIBE_RESULT_TEMPLATE);
    this.totalRecords = 100;
    this.setFieldHistoryMocksForAllFields('Account');
    // plugin cache that stores describe results
    fs.rmSync('.jsc', { recursive: true, force: true });
  }

  public getFilterableFields(sobjectName: string): number {
    let count = 0;
    // one field in our default describe result is non-filterable
    this.describes[sobjectName].fields?.forEach((field) => {
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
      if (this.describes[sobjectName] === undefined) {
        return Promise.reject(new Error(`No describe mock prepared for: ${sobjectName}`));
      }
      return Promise.resolve(this.describes[sobjectName] as AnyJson);
    }
    // mocks for explicit field history queries, mapped by field name
    if (isObject<{ method: string; url: string }>(request)) {
      const queryParam = extractQueryParameter(request.url);
      if (queryParam?.includes('SELECT COUNT(Id),MAX(CreatedDate) FROM')) {
        const fieldName = extractFieldName(request.url);
        if (fieldName && this.fieldHistoryMocks[fieldName] !== undefined) {
          return Promise.resolve({ records: [{ ...this.fieldHistoryMocks[fieldName] }], done: true });
        }
        return Promise.reject(new Error(`No mock was specified for field history query: ${queryParam}`));
      }
      if (queryParam?.includes('COUNT()')) {
        // mocking all the generic COUNT() to get absolute populated of a field
        if (this.queryResults[queryParam] !== undefined) {
          return Promise.resolve({ totalSize: this.queryResults[queryParam], records: [], done: true });
        }
        return Promise.resolve({ totalSize: this.totalRecords, records: [], done: true });
      }
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };

  private setFieldHistoryMocksForAllFields(sobjectName: string) {
    this.describes[sobjectName].fields?.forEach((field) => {
      this.fieldHistoryMocks[field.name] = { expr0: 1, expr1: '2025-07-05' };
    });
  }

  private cloneDescribeMock(sobjectName: string): Partial<DescribeSObjectResult> {
    return { ...structuredClone(MOCK_DESCRIBE_RESULT_TEMPLATE), name: sobjectName };
  }
}

function extractQueryParameter(fullRequestUrl: string): string | undefined {
  const rawQuery = fullRequestUrl.split('?q=')[1];
  return rawQuery ? decodeURIComponent(rawQuery) : undefined;
}

function extractFieldName(fullRequestUrl: string): string | undefined {
  const queryString = extractQueryParameter(fullRequestUrl);
  if (!queryString) {
    return;
  }
  const matchResult = /Field = '[\w]*'/.exec(queryString);
  if (matchResult && matchResult.length >= 1) {
    return matchResult[0].split(' = ')[1].replaceAll("'", '');
  } else {
    return;
  }
}
