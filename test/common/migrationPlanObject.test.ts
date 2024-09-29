import fs from 'node:fs';
import { expect } from 'chai';
import sinon from 'sinon';
import { isString, type AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';
import { MockOrderDescribeResult } from '../data/describes/mockOrderDescribeResult.js';
import { MockAccountDescribeResult } from '../data/describes/mockAccountDescribeResult.js';

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
    fs.rmSync(`./.sfdami/${testOrg.username}`, { recursive: true, force: true });
  });

  it('is has only query file => returns string from file', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );
    await testObj.load();
    sinon.stub(MigrationPlanObject.prototype, 'checkQuery').resolves(true);

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    // the file is auto-formatted! Query builder replaces all formatting with single whitespace
    expect(await testObj.resolveQueryString()).to.equal('SELECT Id, Name, BillingStreet FROM Account LIMIT 9500');
  });

  it('is has only query string => returns direct input string', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
      },
      await testOrg.getConnection()
    );
    await testObj.load();

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.resolveQueryString()).to.equal('SELECT Id FROM Account');
  });

  it('is has no query defined => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
      },
      await testOrg.getConnection()
    );
    await testObj.load();

    // Assert
    expect(() => testObj.selfCheck()).to.throw(NoQueryDefinedForAccount);
  });

  it('is has query and query file => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );
    await testObj.load();

    // Assert
    expect(() => testObj.selfCheck()).to.throw(TooManyQuerySourcesDefined);
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
    // mock describe result in cache
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);
    await testObj.load();

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.resolveQueryString()).to.equal(
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
    await testObj.load();

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.resolveQueryString()).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
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
    await testObj.load();

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.resolveQueryString()).to.equal(
      'SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order LIMIT 1000'
    );
  });

  it('has invalid query string => validates query syntax in self check', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      expect(request).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (isString(request) && request.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve({ status: 0, records: [] });
      }
      return Promise.resolve({});
    };
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id,InvalidField__x FROM Account',
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);
    await testObj.load();

    // Assert
    expect(() => testObj.selfCheck()).to.throw('Invalid query syntax: SELECT Id,InvalidField__x FROM Account');
  });

  it('has invalid query string with LIMIT => validates query syntax in self check', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      expect(request).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (isString(request) && request.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve({ status: 0, records: [] });
      }
      return Promise.reject('Unexpected query was executed');
    };
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id,InvalidField__x FROM Account LIMIT 100',
      },
      await testOrg.getConnection()
    );
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);
    await testObj.load();

    // Assert
    expect(() => testObj.selfCheck()).to.throw(
      'Invalid query syntax: SELECT Id,InvalidField__x FROM Account LIMIT 100'
    );
  });

  it('has complex query from file => validates query syntax in self check', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      console.log(request);
      // console.log(request);
      // if (
      //   isString(request) &&
      //   request.includes(
      //     'query?q=SELECT%0A%20%20Id%2C%0A%20%20Name%2C%0A%20%20BillingStreet%0AFROM%0A%20%20Account%0ALIMIT%201'
      //   )
      // ) {
      // }
      return Promise.resolve({ status: 0, records: [] });
      // return Promise.reject('Unexpected query was executed');
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
    await testObj.load();

    // Assert
    expect(testObj.selfCheck()).to.be.true;
  });
});
