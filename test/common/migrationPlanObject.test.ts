import fs from 'node:fs';
import { expect } from 'chai';
import sinon from 'sinon';
import { type AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';
import { MockAccountDescribeResult, MockOrderDescribeResult } from '../data/describes/mockDescribeResults.js';
import { GenericSuccess, InvalidFieldInQuery } from '../data/api/queryResults.js';
import { LOCAL_CACHE_DIR } from '../../src/common/constants.js';

const TooManyQuerySourcesDefined: string =
  'More than one query provided. queryString OR queryFile or queryObject are allowed.';
const NoQueryDefinedForAccount: string = 'No query defined for: Account';

describe('migration plan object', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    sinon.restore();
    // better to stub the describeAPI entirely
    fs.rmSync(`./${LOCAL_CACHE_DIR}/${testOrg.username}`, { recursive: true, force: true });
  });

  it('has only query file => returns string from file', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Assert
    // the file is auto-formatted! Query builder replaces all formatting with single whitespace
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
  });

  it('has only query string => returns direct input string', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
      },
      await testOrg.getConnection()
    );
    // don't load, because describe API is not stubbed
    // await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id FROM Account');
  });

  it('has no query defined => loading fails', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
      },
      await testOrg.getConnection()
    );

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(NoQueryDefinedForAccount);
    }
  });

  it('is has query and query file => loading fails', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(TooManyQuerySourcesDefined);
    }
  });

  it('is has full query object with "all" fields => creates SOQL from describe', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, filter: "Account.CurrencyIsoCode = 'EUR'", limit: 10_000 },
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE Account.CurrencyIsoCode = 'EUR' LIMIT 10000"
    );
  });

  it('is has query object without filter => creates SOQL without WHERE', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true },
      },
      await testOrg.getConnection()
    );
    // mock describe result in cache
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
  });

  it('is has query object with limit => creates SOQL with LIMIT', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, limit: 1000 },
      },
      await testOrg.getConnection()
    );
    // mock describe result in cache
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal(
      'SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order LIMIT 1000'
    );
  });

  it('has invalid query string syntax => loading fails', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.reject(InvalidFieldInQuery);
      }
      return Promise.reject({ errorCode: 'UNEXPECTED_REJECT_WRONG_REQUEST' });
    };
    const queryInput = 'SELECT Id,InvalidField__x FROM Account';
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: queryInput,
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(queryInput);
    }
  });

  it('has invalid query string with LIMIT => loading fails', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve(GenericSuccess);
      }
      return Promise.reject('Unexpected query was executed');
    };
    const queryInput = 'SELECT Id,InvalidField__x FROM Account LIMIT 100';
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: queryInput,
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(queryInput);
    }
  });

  it('has complex query from file => query successfully validated during load', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CName%2CBillingStreet%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve(GenericSuccess);
      }
      return Promise.reject({ data: { message: 'Unexpected query was executed' } });
    };
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockAccountDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
  });
});
