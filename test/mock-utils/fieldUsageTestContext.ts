/* eslint-disable class-methods-use-this */
import fs from 'node:fs';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import { AnyJson, isObject, isString } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { DescribeRecordTypeResult, RecordTypeInfo } from '../../src/types/platformTypes.js';

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
    { name: 'MyPicklist__c', type: 'picklist', filterable: true, custom: true, defaultValue: 'Default' },
    { name: 'MyPicklist2__c', type: 'picklist', filterable: true, custom: true, defaultValue: 'Default 2' },
  ] as Field[],
  recordTypeInfos: [
    { developerName: 'Master', recordTypeId: '012000000000000AAA', master: true },
    { developerName: 'Test_Type_1', recordTypeId: '012000000000001AAA', master: false },
    { developerName: 'Test_Type_2', recordTypeId: '012000000000002AAA', master: false },
  ] as RecordTypeInfo[],
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

const RECORD_TYPE_DESCRIBE_TEMPLATE = {
  active: true,
  label: 'Test Record Type',
  picklistValues: [
    {
      picklist: 'MyPicklist__c',
      values: [
        {
          valueName: 'RT Default',
          default: true,
        },
        {
          valueName: 'RT no default',
          default: false,
        },
      ],
    },
    {
      picklist: 'MyPicklist2__c',
      values: [
        {
          valueName: 'Value 1',
          default: false,
        },
        {
          valueName: 'Value 2',
          default: false,
        },
      ],
    },
  ],
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
  /** Key/value map of record type "Metadata" property. Key is record type id */
  public recordTypeMocks: Record<string, DescribeRecordTypeResult> = {};

  public constructor() {
    this.coreContext = new TestContext();
    this.testTargetOrg = new MockTestOrgData();
    this.totalRecords = 100;
    this.describes['Account'] = cloneDescribeMock('Account');
    this.describes['Order'] = cloneDescribeMock('Order');
    this.describes['AccountHistory'] = structuredClone(HISTORY_DESCRIBE_RESULT_TEMPLATE);
    this.setFieldHistoryMocksForAllFields('Account');
    this.recordTypeMocks['012000000000001AAA'] = cloneRecordType('Record Type 1');
    this.recordTypeMocks['012000000000002AAA'] = cloneRecordType('Record Type 2');
  }

  public init() {
    this.coreContext.fakeConnectionRequest = this.mockQueryResults;
  }

  public restore() {
    this.coreContext.restore();
    this.describes['Account'] = cloneDescribeMock('Account');
    this.describes['Order'] = cloneDescribeMock('Order');
    this.describes['AccountHistory'] = structuredClone(HISTORY_DESCRIBE_RESULT_TEMPLATE);
    this.totalRecords = 100;
    this.setFieldHistoryMocksForAllFields('Account');
    this.recordTypeMocks['012000000000001AAA'] = cloneRecordType('Record Type 1');
    this.recordTypeMocks['012000000000002AAA'] = cloneRecordType('Record Type 2');
    // plugin cache that stores describe results
    fs.rmSync('.jsc', { recursive: true, force: true });
  }

  /**
   * Counts all filterable fields for an sobject, based on the mocked describe.
   *
   * @param sobjectName
   * @returns
   */
  public getFilterableFields(sobjectName: string): number {
    if (this.describes[sobjectName].fields) {
      return this.describes[sobjectName].fields?.reduce((prev, curr) => (curr.filterable ? prev + 1 : prev), 0);
    } else {
      return 0;
    }
  }

  /**
   * Counts all filterable custom fields for an sobject, based on the
   * mocked describe.
   *
   * @param sobjectName
   * @returns
   */
  public getFilterableCustomFieldCount(sobjectName: string): number {
    if (this.describes[sobjectName].fields) {
      return this.describes[sobjectName].fields?.reduce(
        (prev, curr) => (curr.custom && curr.filterable ? prev + 1 : prev),
        0
      );
    } else {
      return 0;
    }
  }

  /**
   * Counts all formula fields for an sobject, based on the mocked describe
   *
   * @param sobjectName
   * @returns
   */
  public getFormulaFieldCount(sobjectName: string): number {
    if (this.describes[sobjectName].fields) {
      return this.describes[sobjectName].fields?.reduce((prev, curr) => (curr.calculated ? prev + 1 : prev), 0);
    } else {
      return 0;
    }
  }

  public readonly mockQueryResults = (request: AnyJson): Promise<AnyJson> => {
    // all describe calls
    if (isString(request) && request.endsWith('/describe')) {
      const requestUrl = request.split('/');
      const sobjectName = requestUrl[requestUrl.length - 2];
      if (this.describes[sobjectName] === undefined) {
        // the actual error message, if sobject type is not found with little debugging info
        return Promise.reject({
          data: { errorCode: 'NOT_FOUND', message: `The requested resource ${sobjectName} does not exist` },
        });
      }
      return Promise.resolve(this.describes[sobjectName] as AnyJson);
    }
    // mocks for explicit field history queries, mapped by field name
    if (isObject<{ method: string; url: string }>(request)) {
      if (queryIncludes(request.url, 'SELECT Metadata FROM RecordType')) {
        const recordTypeId = extractRecordTypeId(request.url);
        if (recordTypeId && this.recordTypeMocks[recordTypeId] !== undefined) {
          return Promise.resolve({
            records: [{ Metadata: this.recordTypeMocks[recordTypeId] }],
            done: true,
            totalSize: 1,
          });
        }
        return Promise.reject(new Error(`No mock set for record type query: ${decodeQueryParameter(request.url)}`));
      }
      const queryParam = decodeQueryParameter(request.url);
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
}

function cloneDescribeMock(sobjectName: string): Partial<DescribeSObjectResult> {
  return { ...structuredClone(MOCK_DESCRIBE_RESULT_TEMPLATE), name: sobjectName };
}

function cloneRecordType(name: string): DescribeRecordTypeResult {
  return { ...structuredClone(RECORD_TYPE_DESCRIBE_TEMPLATE as DescribeRecordTypeResult), label: name };
}

function queryIncludes(requestUrl: string, substring: string): boolean {
  return decodeQueryParameter(requestUrl)?.includes(substring) ?? false;
}

function decodeQueryParameter(fullRequestUrl: string): string | undefined {
  const rawQuery = fullRequestUrl.split('?q=')[1];
  return rawQuery ? decodeURIComponent(rawQuery) : undefined;
}

function extractFieldName(fullRequestUrl: string): string | undefined {
  const queryString = decodeQueryParameter(fullRequestUrl);
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

function extractRecordTypeId(fullRequestUrl: string): string | undefined {
  const queryString = decodeQueryParameter(fullRequestUrl);
  if (!queryString) {
    return;
  }
  const matchResult = /Id = '[\w\d]{18}'/.exec(queryString);
  if (matchResult && matchResult.length >= 1) {
    return matchResult[0].split(' = ')[1].replaceAll("'", '');
  } else {
    return;
  }
}
