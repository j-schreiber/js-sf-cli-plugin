import fs from 'node:fs';
import { isString, type AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import DescribeApi from '../../src/common/metadata/describeApi.js';

const testUsername = 'describe-api-test@lietzau-consulting.de';
const expectedAccountDescribe = JSON.parse(fs.readFileSync('test/data/describes/Account.json', 'utf8')) as AnyJson;
const cacheDir = `./.sfdami/${testUsername}/describes`;

describe('describe api', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    testOrg.username = testUsername;
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    fs.rmSync(`./.sfdami/${testUsername}`, { recursive: true, force: true });
  });

  it('no describe results cached for sobject > calls sobject describe', async () => {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      // mock org uses v42.0 and this cannot be overwritten
      if (isString(request) && request.includes('/services/data/v42.0/sobjects/Account/describe')) {
        return Promise.resolve(expectedAccountDescribe);
      }
      return Promise.resolve({});
    };

    // Act
    const descApi: DescribeApi = new DescribeApi(await testOrg.getConnection());
    const result = await descApi.describeSObject('Account');

    // Assert
    expect(result).to.deep.equal(expectedAccountDescribe);
  });

  it('describe result cached for sobject > reads file from cache', async () => {
    // Arrange
    const mockOrderDescribeResult = { actionOverrides: [], fields: [] };
    // return empty result for any request that is performed
    $$.fakeConnectionRequest = (): Promise<AnyJson> => Promise.resolve({});
    fs.mkdirSync(`${cacheDir}`, { recursive: true });
    fs.writeFileSync(`${cacheDir}/Order.json`, JSON.stringify(mockOrderDescribeResult));

    // Act
    const descApi: DescribeApi = new DescribeApi(await testOrg.getConnection());
    const result = await descApi.describeSObject('Order');

    // Assert
    expect(result).to.deep.equal(mockOrderDescribeResult);
  });
});
