import { expect } from 'chai';
import { AnyJson } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import PackageGarbageResult from '../../src/garbage-collection/garbageManager.js';
import GarbageCollectionMocks from '../mock-utils/garbageCollectionMocks.js';

describe('garbage manager', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let mocks: GarbageCollectionMocks;

  beforeEach(async () => {
    mocks = new GarbageCollectionMocks();
    testOrg.isDevHub = false;
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = mockQueryResults;
  });

  function mockQueryResults(request: AnyJson): Promise<AnyJson> {
    return mocks.mockQueryResults(request);
  }

  afterEach(() => {
    $$.SANDBOX.restore();
  });
});
