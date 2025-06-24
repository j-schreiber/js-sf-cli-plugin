import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JscMaintainFieldUsageAnalyse from '../../../../../src/commands/jsc/maintain/field-usage/analyse.js';
import FieldUsageTestContext from '../../../../mock-utils/fieldUsageTestContext.js';

describe('jsc maintain field-usage analyse', () => {
  const $$ = new FieldUsageTestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(async () => {
    await $$.init();
    sfCommandStubs = stubSfCommandUx($$.coreContext.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('analyses fields for sobject and prints table with usage statistics', async () => {
    // Act
    await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--sobject',
      'Order',
    ]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(2);
  });

  it('analyses fields for sobject and returns json result with both sobjects', async () => {
    // Act
    const result = await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--sobject',
      'Order',
      '--json',
    ]);

    // Assert
    const expectedAnalysableFieldsFromDescribeMock = 6;
    expect(Object.keys(result.sobjects)).to.deep.equal(['Account', 'Order']);
    expect(result.sobjects.Account.name).to.equal('Account');
    expect(result.sobjects.Account.fields.length).to.equal(expectedAnalysableFieldsFromDescribeMock);
    expect(result.sobjects.Order.name).to.equal('Order');
    expect(result.sobjects.Order.fields.length).to.equal(expectedAnalysableFieldsFromDescribeMock);
  });

  it('throws an error when invalid sobject name is provided', async () => {
    // Arrange
    $$.coreContext.fakeConnectionRequest = $$.mockDescribeFailure;

    // Act
    try {
      await JscMaintainFieldUsageAnalyse.run([
        '--target-org',
        $$.testTargetOrg.username,
        '--sobject',
        'InvalidSObjectName__c',
      ]);
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      // this.error(...) returns 2, uncaught SfError returns 1
      expect(err.exitCode).to.equal(2);
      expect(err.message).to.contain('InvalidSObjectName__c');
    }
  });
});
