import { expect } from 'chai';
import sinon from 'sinon';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import MigrationPlanLoader from '../../src/common/migrationPlanLoader.js';
import { mockAnySObjectDescribe } from '../mock-utils/sfQueryApiMocks.js';

describe('migration plan', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = mockAnySObjectDescribe;
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    sinon.restore();
  });

  it('loads valid plan file successfully', async () => {
    // Act
    const plan = await MigrationPlanLoader.loadPlan('test/data/plans/test-plan.yaml', await testOrg.getConnection());

    // Assert
    expect(plan.getObjects().length).equals(4);
  });

  it('throws parse error if child binds to unknown parent ids', async () => {
    // Act
    try {
      await MigrationPlanLoader.loadPlan('test/data/plans/unknown-parent-ids.yaml', await testOrg.getConnection());
      expect.fail('Should throw exception');
    } catch (err) {
      if (err instanceof SfError) {
        expect(err.name).to.equal('InvalidPlanFileSyntax');
        expect(err.message).to.contain('Contact references a parent bind that was not defined: myAccountIds');
      } else {
        expect.fail('Expected SfError, but got: ' + JSON.stringify(err));
      }
    }
  });

  it('throws parse error if two objects export the same id', async () => {
    // Act
    try {
      await MigrationPlanLoader.loadPlan('test/data/plans/duplicate-parent-ids.yaml', await testOrg.getConnection());
      expect.fail('Should throw exception');
    } catch (err) {
      if (err instanceof SfError) {
        expect(err.name).to.equal('InvalidPlanFileSyntax');
        expect(err.message).to.contain('Contact exports a bind variable that was already defined: myIds');
      } else {
        expect.fail('Expected SfError, but got: ' + JSON.stringify(err));
      }
    }
  });
});
