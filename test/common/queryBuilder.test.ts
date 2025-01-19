import { expect } from 'chai';
import sinon from 'sinon';
import { Messages } from '@salesforce/core';
import { type AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import QueryBuilder from '../../src/common/utils/queryBuilder.js';
import { GenericRejection, GenericSuccess } from '../data/api/queryResults.js';
import {
  MockAccountDescribeResult,
  MockAnyObjectResult,
  MockOrderDescribeResult,
  MockPackageMemberDescribeResult,
} from '../data/describes/mockDescribeResults.js';
import PlanCache from '../../src/common/planCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'exportplan');

const ORDER_PLAN_OBJECT_WITH_BIND = {
  objectName: 'Order',
  query: {
    fetchAllFields: true,
    bind: { field: 'AccountId', variable: 'myAccountIds' },
  },
};

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

  it('has only query file => returns string from file', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      MockAnyObjectResult as DescribeSObjectResult
    );

    // Assert
    // the file is auto-formatted! Query builder replaces all formatting with single whitespace
    expect(testBuilder.toSOQL()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
    expect(testBuilder.toValidatorSOQL()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 0');
  });

  it('has only query string => returns direct input string', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
      },
      MockAnyObjectResult as DescribeSObjectResult
    );

    // Assert
    expect(testBuilder.toSOQL()).to.equal('SELECT Id FROM Account');
    expect(testBuilder.toValidatorSOQL()).to.equal('SELECT Id FROM Account LIMIT 0');
  });

  it('has no query defined => loading fails', async () => {
    // Assert
    try {
      new QueryBuilder(
        {
          objectName: 'Account',
        },
        MockAnyObjectResult as DescribeSObjectResult
      );
      expect.fail('Expected to fail, but succeeded');
    } catch (err) {
      const noQueryMsg = messages.createError('NoQueryDefinedForSObject', ['Account']);
      expect(String(err)).to.contain(noQueryMsg);
    }
  });

  it('is has query and query file => loading fails', async () => {
    // Assert
    try {
      new QueryBuilder(
        {
          objectName: 'Account',
          queryString: 'SELECT Id FROM Account',
          queryFile: 'test/data/soql/accounts.sql',
        },
        MockAnyObjectResult as DescribeSObjectResult
      );
      expect.fail('Expected to fail, but succeeded');
    } catch (err) {
      const expectedErrorMsg = messages.createError('TooManyQueriesDefined');
      expect(String(err)).to.contain(expectedErrorMsg);
    }
  });

  it('make validator query > has LIMIT with line breaks => replaces with LIMIT 1', async () => {
    // Arrange
    const testData: Record<string, string> = {
      'SELECT Id FROM Order LIMIT 1234': 'SELECT Id FROM Order LIMIT 0',
      'SELECT Id FROM Order\nLIMIT\n999': 'SELECT Id FROM Order LIMIT 0',
      'SELECT Id FROM Order\nLIMIT\n  10000': 'SELECT Id FROM Order LIMIT 0',
      'SELECT Id FROM Order\n  LIMIT\n  2': 'SELECT Id FROM Order LIMIT 0',
    };

    // Assert
    Object.keys(testData).forEach((inputString) => {
      const testBuilder = new QueryBuilder(
        { objectName: 'Account', queryString: inputString },
        MockAccountDescribeResult as DescribeSObjectResult
      );
      expect(testBuilder.toValidatorSOQL()).equals(testData[inputString], 'for input ' + inputString);
    });
  });

  it('make validator query > as bind variable that is not initialised => adds bind with empty IN filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'AnyObject',
        query: {
          fetchAllFields: false,
          bind: { field: 'AccountId', variable: 'myAccIds' },
        },
      },
      MockAnyObjectResult as DescribeSObjectResult
    );

    // Assert
    expect(testBuilder.toSOQL()).to.equal("SELECT Id FROM AnyObject WHERE AccountId IN ('') AND AccountId != NULL");
    expect(testBuilder.toSOQL([])).to.equal("SELECT Id FROM AnyObject WHERE AccountId IN ('') AND AccountId != NULL");
    expect(testBuilder.toValidatorSOQL()).to.equal(
      "SELECT Id FROM AnyObject WHERE AccountId IN ('') AND AccountId != NULL LIMIT 0"
    );
  });

  it('loads query from file > removes line breaks and spaces from fields', async () => {
    // Arrange
    const testData: Record<string, string> = {
      'test/data/soql/accounts.sql': 'SELECT Id,Name,BillingStreet FROM Account LIMIT 9500',
      'test/data/soql/package-members.sql':
        'SELECT Id,MaxPackageVersion.Name,SubscriberPackage.Name,SubjectId,SubjectKeyPrefix FROM Package2Member WHERE MaxPackageVersionId != NULL ORDER BY SubjectKeyPrefix',
    };
    // Assert
    Object.keys(testData).forEach((inputFile) => {
      const testBuilder = new QueryBuilder(
        { objectName: 'Account', queryFile: inputFile },
        MockAccountDescribeResult as DescribeSObjectResult
      );
      expect(testBuilder.toSOQL()).equals(testData[inputFile]);
    });
  });

  it('to SOQL > add all fields > builds with all fields from describe', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Account',
        query: {
          fetchAllFields: true,
        },
      },
      MockAccountDescribeResult as DescribeSObjectResult
    );

    // Assert
    expect(testBuilder.toSOQL()).equals('SELECT Id,Name,AccountNumber,CreatedDate,BillingStreet FROM Account');
    expect(testBuilder.toValidatorSOQL()).equals(
      'SELECT Id,Name,AccountNumber,CreatedDate,BillingStreet FROM Account LIMIT 0'
    );
  });

  it('assert query syntax > is tooling object > runs against tooling API', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      if (url.includes('/tooling/') && url.endsWith('LIMIT%200')) {
        return Promise.resolve(GenericSuccess);
      } else {
        return Promise.reject(GenericRejection);
      }
    };
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Package2Member',
        queryString: 'SELECT Id FROM Package2Member',
      },
      MockPackageMemberDescribeResult as DescribeSObjectResult
    );

    // Act
    const isValid = await testBuilder.assertSyntax(await testOrg.getConnection());

    // Assert
    expect(isValid).to.be.true;
  });

  it('assert query syntax > has unlimited query > queries API with LIMIT 0', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      if (url.endsWith('LIMIT%200')) {
        return Promise.resolve(GenericSuccess);
      } else {
        return Promise.reject(GenericRejection);
      }
    };
    const testBuilder = new QueryBuilder(ORDER_PLAN_OBJECT_WITH_BIND, MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    const isValid = await testBuilder.assertSyntax(await testOrg.getConnection());

    // Assert
    expect(isValid).to.be.true;
  });

  it('formats soql with parent-child bind > exported variable has values > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(ORDER_PLAN_OBJECT_WITH_BIND, MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    const queryString = testBuilder.toSOQL(['1', '2', '3', '4']);

    // Assert
    expect(queryString).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN ('1','2','3','4') AND AccountId != NULL"
    );
  });

  it('formats soql with parent-child bind > variable not cached > ignores bind', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(ORDER_PLAN_OBJECT_WITH_BIND, MockOrderDescribeResult as DescribeSObjectResult);

    // Assert
    expect(testBuilder.toSOQL(undefined)).equals(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN ('') AND AccountId != NULL"
    );
    expect(testBuilder.toDisplaySOQL()).equals(
      'SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE AccountId IN :myAccountIds AND AccountId != NULL'
    );
  });

  it('formats soql with parent-child bind > empty ids cached > adds to filter', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(ORDER_PLAN_OBJECT_WITH_BIND, MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    const queryString = testBuilder.toSOQL([]);

    // Assert
    expect(queryString).to.contains("WHERE AccountId IN ('') AND AccountId != NULL");
  });

  it('formats soql with parent-child bind and filter > exported variable has values > adds to filter with AND', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Order',
        query: {
          fetchAllFields: true,
          bind: { field: 'AccountId', variable: 'myAccountIds' },
          filter: "Status = 'Draft'",
        },
      },
      MockOrderDescribeResult as DescribeSObjectResult
    );

    // Act
    const queryString = testBuilder.toSOQL(['1', '2', '3', '4']);

    // Assert
    expect(queryString).contains("WHERE (Status = 'Draft') AND AccountId IN ('1','2','3','4') AND AccountId != NULL");
  });

  it('formats soql with parent bind, filter, and limit > all elements in SOQL', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(
      {
        objectName: 'Order',
        query: {
          fetchAllFields: true,
          bind: { field: 'AccountId', variable: 'myAccountIds' },
          filter: "Status = 'Draft'",
          limit: 1000,
        },
      },
      MockOrderDescribeResult as DescribeSObjectResult
    );

    // Act
    const queryString = testBuilder.toSOQL(['1', '2', '3', '4']);

    // Assert
    expect(queryString).contains(
      "FROM Order WHERE (Status = 'Draft') AND AccountId IN ('1','2','3','4') AND AccountId != NULL LIMIT 1000"
    );
  });

  it('build list filter with valid name and non-empty list', async () => {
    // Assert
    expect(QueryBuilder.buildParamListFilter('Id', [1, 2, 3, 4])).to.equal("Id IN ('1','2','3','4') AND Id != NULL");
    expect(QueryBuilder.buildParamListFilter('MyField__c', ['a', 'b', 'c'])).to.equal(
      "MyField__c IN ('a','b','c') AND MyField__c != NULL"
    );
  });
});
