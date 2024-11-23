import { expect } from 'chai';
import sinon from 'sinon';
import { type AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import QueryBuilder from '../../src/common/utils/queryBuilder.js';
import { GenericRejection, GenericSuccess } from '../data/api/queryResults.js';
import {
  MockAccountDescribeResult,
  MockOrderDescribeResult,
  MockPackageMemberDescribeResult,
} from '../data/describes/mockDescribeResults.js';
import { ZQueryObjectType } from '../../src/types/migrationPlanObjectData.js';
import PlanCache from '../../src/common/planCache.js';

describe('query builder', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    sinon.restore();
    PlanCache.flush();
  });

  it('make validator query > has LIMIT with line breaks => replaces with LIMIT 1', async () => {
    // Assert
    expect(QueryBuilder.makeValidatorQuery('SELECT Id FROM Order LIMIT 1234')).to.equal('SELECT Id FROM Order LIMIT 1');
    expect(QueryBuilder.makeValidatorQuery('SELECT Id FROM Order\nLIMIT\n999')).to.equal(
      'SELECT Id FROM Order LIMIT 1'
    );
    expect(QueryBuilder.makeValidatorQuery('SELECT Id FROM Order\nLIMIT\n  10000')).to.equal(
      'SELECT Id FROM Order LIMIT 1'
    );
    expect(QueryBuilder.makeValidatorQuery('SELECT Id FROM Order\n  LIMIT\n  2')).to.equal(
      'SELECT Id FROM Order LIMIT 1'
    );
  });

  it('to SOQL > add all fields > builds with all fields from describe', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockAccountDescribeResult as DescribeSObjectResult);

    // Act
    testBuilder.addAllFields();

    // Assert
    expect(testBuilder.toSOQL()).to.equal('SELECT Id,Name,AccountNumber,BillingStreet FROM Account');
  });

  it('assert query syntax > is tooling object > runs against tooling API', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      if (url.includes('/tooling/')) {
        return Promise.resolve(GenericSuccess);
      } else {
        return Promise.reject(GenericRejection);
      }
    };
    const testBuilder = new QueryBuilder(MockPackageMemberDescribeResult as DescribeSObjectResult);

    // Act
    const isValid = await testBuilder.assertSyntax(await testOrg.getConnection(), 'SELECT Id FROM Package2Member');

    // Assert
    expect(isValid).to.be.true;
  });

  it('formats soql with parent-child bind > exported variable is cached > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    PlanCache.set('myAccountIds', ['1', '2', '3', '4']);
    const queryObj = { fetchAllFields: true, parent: { field: 'AccountId', bind: 'myAccountIds' } } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj);

    // Assert
    expect(queryString).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN ('1','2','3','4')"
    );
  });

  it('formats soql with parent-child bind > variable not cached > ignores bind', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = { fetchAllFields: true, parent: { field: 'AccountId', bind: 'myAccountIds' } } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj);

    // Assert
    expect(queryString).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
  });

  it('formats soql with parent-child bind > empty ids cached > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    PlanCache.set('myAccountIds', []);
    const queryObj = { fetchAllFields: true, parent: { field: 'AccountId', bind: 'myAccountIds' } } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj);

    // Assert
    expect(queryString).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN ()');
  });

  it('formats soql with parent-child bind and filter > variable is cached > adds to filter with AND', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    PlanCache.set('myAccountIds', ['1', '2', '3', '4']);
    const queryObj = {
      fetchAllFields: true,
      parent: { field: 'AccountId', bind: 'myAccountIds' },
      filter: "Status = 'Draft'",
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj);

    // Assert
    expect(queryString).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE (Status = 'Draft') AND AccountId IN ('1','2','3','4')"
    );
  });
});
