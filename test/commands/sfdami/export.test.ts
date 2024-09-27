import fs from 'node:fs';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import SfdamiExport from '../../../src/commands/sfdami/export.js';

describe('sfdami plan export', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    testOrg = new MockTestOrgData();
    testOrg.orgId = '00Dxx0000000000AAA';
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(`./.sfdami/${testOrg.username}`, { recursive: true, force: true });
  });

  it('runs command with required params => exits OK', async () => {
    // Arrange
    await $$.stubAuths(testOrg);

    // Act
    const result = await SfdamiExport.run(['--source-org', testOrg.username, '--plan', 'test/data/test-plan.yaml']);

    // Assert
    expect(result).to.be.ok;
    // only there so the stupid linter does not complain
    // until I figured out how to assert on that thing
    // sfCommandStubs.log returns each call to this.log(...) as array
    expect(sfCommandStubs).to.be.ok;
    expect(result['source-org-id']).equals(testOrg.orgId);
  });

  it('runs command with invalid plan file => exits error', async () => {
    // Arrange
    await $$.stubAuths(testOrg);

    // Act
    try {
      // shouldThrow appears to throw an SfError
      await SfdamiExport.run(['--source-org', testOrg.username, '--plan', 'test/data/invalid-plan.yaml']);
      expect.fail('Should throw exception');
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      expect(err.exitCode).to.equal(2);
    }
  });
});
