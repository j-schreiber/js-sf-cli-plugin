import { expect } from 'chai';
import sinon from 'sinon';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';

const mockOrderDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  fields: [
    { name: 'Id' } as Field,
    { name: 'OrderNumber' } as Field,
    { name: 'AccountId' } as Field,
    { name: 'BillToContactId' } as Field,
  ],
};

describe('migration plan object', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    sinon.restore();
  });

  it('is initialised with query file => returns string from file', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    // the file is auto-formatted! Its critical to match exact file formatting for asserts
    // actual validation (syntax, runtime schema, etc) will be performed by the target org
    expect(await testObj.getQueryString()).to.equal(
      'SELECT\n  Id,\n  Name,\n  BillingStreet\nFROM\n  Account\nLIMIT\n  9500'
    );
  });

  it('is initialised with query string => returns direct input string', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
      },
      await testOrg.getConnection()
    );

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.getQueryString()).to.equal('SELECT Id FROM Account');
  });

  it('is initialised without query or query file => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
      },
      await testOrg.getConnection()
    );

    // Act
    expect(testObj.selfCheck()).to.not.be.true;

    // Assert
  });

  it('is initialised with query and query file => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Act
    expect(testObj.selfCheck()).to.not.be.true;

    // Assert
  });

  it('is initialised with full query object with "all" fields => creates SOQL from describe', async () => {
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
      .resolves(mockOrderDescribeResult as DescribeSObjectResult);

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.getQueryString()).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE Account.CurrencyIsoCode = 'EUR' LIMIT 10000"
    );
  });

  it('is initialised with query object without filter => creates SOQL without WHERE', async () => {
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
      .resolves(mockOrderDescribeResult as DescribeSObjectResult);

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.getQueryString()).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
  });

  it('is initialised with query object with limit => creates SOQL with LIMIT', async () => {
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
      .resolves(mockOrderDescribeResult as DescribeSObjectResult);

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(await testObj.getQueryString()).to.equal(
      'SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order LIMIT 1000'
    );
  });
});
