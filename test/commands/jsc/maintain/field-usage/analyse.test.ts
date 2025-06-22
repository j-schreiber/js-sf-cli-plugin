import { expect } from 'chai';
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
});
