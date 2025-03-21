import { expect } from 'chai';
import { AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SubscriberPackage } from '../../src/types/sfToolingApiTypes.js';
import ToolingApiConnection from '../../src/garbage-collection/toolingApiConnection.js';
import { parseFileAsQueryResult } from '../mock-utils/sfQueryApiMocks.js';

const TEST_FILES_ROOT = ['test', 'data', 'query-results'];

describe('tooling API connection', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let testConnection: ToolingApiConnection;

  const SUBSCRIBER_PACKAGE = parseFileAsQueryResult<SubscriberPackage>([...TEST_FILES_ROOT, 'subscriber-package.json']);
  const EMPTY_QUERY_RESULT = parseFileAsQueryResult<SubscriberPackage>([...TEST_FILES_ROOT, 'empty-result.json']);

  beforeEach(async () => {
    testOrg.isDevHub = false;
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = mockQueryResults;
    // getInstance caches and shares the same instance accross test classes
    testConnection = new ToolingApiConnection(await testOrg.getConnection());
  });

  afterEach(() => {
    $$.SANDBOX.restore();
  });

  function mockQueryResults(request: AnyJson): Promise<AnyJson> {
    const url = (request as { url: string }).url;
    if (url.includes(encodeURIComponent("FROM SubscriberPackage WHERE Id = '0336f000000G8roAAC'"))) {
      return Promise.resolve(SUBSCRIBER_PACKAGE);
    }
    if (url.includes(encodeURIComponent("FROM SubscriberPackage WHERE Id = '0330X0000000000AAA'"))) {
      return Promise.resolve(EMPTY_QUERY_RESULT);
    }
    throw new Error(`Request not mocked: ${JSON.stringify(request)}`);
  }

  it('queries subscriber package when resolving a package id', async () => {
    // Act
    const actualSubPackage = await testConnection.resolveSubscriberPackageId('0336f000000G8roAAC');

    // Assert
    expect(actualSubPackage).not.to.be.undefined;
    expect(actualSubPackage!.Id).to.equal('0336f000000G8roAAC');
    expect(actualSubPackage!.Name).to.equal('JS Apex Utils');
  });

  it('returns undefined if queried with an invalid or unknown subscriber package id', async () => {
    // Act
    const actualSubPackage = await testConnection.resolveSubscriberPackageId('0330X0000000000AAA');

    // Assert
    expect(actualSubPackage).to.be.undefined;
  });
});
