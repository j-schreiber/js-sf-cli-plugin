/* eslint-disable class-methods-use-this */
import { AnyJson, isObject, isString } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { MockAnyObjectResult } from '../data/describes/mockDescribeResults.js';

export default class FieldUsageTestContext {
  public coreContext: TestContext;
  public testTargetOrg: MockTestOrgData;

  public constructor() {
    this.coreContext = new TestContext();
    this.testTargetOrg = new MockTestOrgData();
  }

  public async init() {
    this.coreContext.fakeConnectionRequest = this.mockQueryResults;
  }

  public restore() {
    this.coreContext.restore();
  }

  private readonly mockQueryResults = (request: AnyJson): Promise<AnyJson> => {
    if (isString(request) && request.endsWith('/describe')) {
      const requestUrl = request.split('/');
      const sobjectName = requestUrl[requestUrl.length - 2];
      const describe = { ...MockAnyObjectResult, name: sobjectName };
      return Promise.resolve(describe as AnyJson);
    }
    if (isObject<{ method: string; url: string }>(request) && request.url.includes('COUNT(Id)')) {
      return Promise.resolve({ records: [{ expr0: 0 }], done: true });
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };
}
