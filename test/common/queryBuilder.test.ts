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

  it('loads query from file > removes line breaks and spaces from fields', async () => {
    // Assert
    expect(QueryBuilder.loadFromFile('test/data/soql/accounts.sql')).equals(
      'SELECT Id,Name,BillingStreet FROM Account LIMIT 9500'
    );
    expect(QueryBuilder.loadFromFile('test/data/soql/package-members.sql')).equals(
      'SELECT Id,MaxPackageVersion.Name,SubscriberPackage.Name,SubjectId,SubjectKeyPrefix FROM Package2Member WHERE MaxPackageVersionId != NULL ORDER BY SubjectKeyPrefix'
    );
  });

  it('to SOQL > add all fields > builds with all fields from describe', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockAccountDescribeResult as DescribeSObjectResult);

    // Act
    testBuilder.addAllFields();

    // Assert
    expect(testBuilder.toSOQL()).to.equal('SELECT Id,Name,AccountNumber,CreatedDate,BillingStreet FROM Account');
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

  it('formats soql with parent-child bind > exported variable has values > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = {
      fetchAllFields: true,
      bind: { field: 'AccountId', variable: 'myAccountIds' },
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj, ['1', '2', '3', '4']);

    // Assert
    expect(queryString).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN ('1','2','3','4') AND AccountId != NULL"
    );
  });

  it('formats soql with parent-child bind > variable not cached > ignores bind', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = {
      fetchAllFields: true,
      bind: { field: 'AccountId', variable: 'myAccountIds' },
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj);

    // Assert
    expect(queryString).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
  });

  it('formats soql with parent-child bind > empty ids cached > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = {
      fetchAllFields: true,
      bind: { field: 'AccountId', variable: 'myAccountIds' },
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj, []);

    // Assert
    expect(queryString).to.contains("WHERE AccountId IN ('') AND AccountId != NULL");
  });

  it('formats soql with parent-child bind and filter > exported variable has values > adds to filter with AND', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = {
      fetchAllFields: true,
      bind: { field: 'AccountId', variable: 'myAccountIds' },
      filter: "Status = 'Draft'",
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj, ['1', '2', '3', '4']);

    // Assert
    expect(queryString).to.contains(
      "WHERE (Status = 'Draft') AND AccountId IN ('1','2','3','4') AND AccountId != NULL"
    );
  });

  it('formats soql with parent bind, filter, and limit > all elements in SOQL', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(MockOrderDescribeResult as DescribeSObjectResult);
    const queryObj = {
      fetchAllFields: true,
      bind: { field: 'AccountId', variable: 'myAccountIds' },
      filter: "Status = 'Draft'",
      limit: 1000,
    } as ZQueryObjectType;

    // Act
    const queryString = testBuilder.toSOQL(queryObj, ['1', '2', '3', '4']);

    // Assert
    expect(queryString).to.contains(
      "FROM Order WHERE (Status = 'Draft') AND AccountId IN ('1','2','3','4') AND AccountId != NULL LIMIT 1000"
    );
  });
});
