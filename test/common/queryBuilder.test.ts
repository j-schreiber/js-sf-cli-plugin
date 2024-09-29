import { expect } from 'chai';
import sinon from 'sinon';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import QueryBuilder from '../../src/common/utils/queryBuilder.js';

// const mockOrderDescribeResult: Partial<DescribeSObjectResult> = {
//   custom: false,
//   createable: true,
//   name: 'Order',
//   fields: [
//     { name: 'Id' } as Field,
//     { name: 'OrderNumber' } as Field,
//     { name: 'AccountId' } as Field,
//     { name: 'BillToContactId' } as Field,
//   ],
// };

const mockAccountDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  name: 'Account',
  fields: [
    { name: 'Id' } as Field,
    { name: 'Name' } as Field,
    { name: 'AccountNumber' } as Field,
    { name: 'BillingStreet' } as Field,
  ],
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

  it('to SOQL > add all fields => builds string with all fields', async () => {
    // Arrange
    const testBuilder = new QueryBuilder(mockAccountDescribeResult as DescribeSObjectResult);

    // Act
    testBuilder.addAllFields();

    // Assert
    expect(testBuilder.toSOQL()).to.equal('SELECT Id,Name,AccountNumber,BillingStreet FROM Account');
  });
});
