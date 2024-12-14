import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JscMaintainGarbageCollect from '../../../../../src/commands/jsc/maintain/garbage/collect.js';

describe('jsc maintain garbage collect', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  const testTargetOrg = new MockTestOrgData();

  beforeEach(async () => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    await $$.stubAuths(testTargetOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs command with --json and no other params > exports all deprecated members on target org', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--json']);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result).to.be.ok;
    expect(sfCommandStubs).to.be.ok;
  });
});
