import { expect } from 'chai';
import { ExecuteService } from '@salesforce/apex-node';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JscApexScheduleStop from '../../../../src/commands/jsc/apex/schedule/stop.js';
import AnonymousApexMocks from '../../../mock-utils/anonApexMocks.js';
import QueryRunner from '../../../../src/common/utils/queryRunner.js';

describe('jsc apex schedule', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let anonApexMocks: AnonymousApexMocks;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    anonApexMocks = new AnonymousApexMocks();
    $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords').callsFake(anonApexMocks.queryStub);
    await $$.stubAuths(testOrg);
  });

  it('executes stop script with id on target org when called with valid cron trigger id', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run(['--target-org', testOrg.username, '--id', '08e9b00000KiFENAA3']);

    // Assert
    expect(executeServiceStub.args.flat()).to.deep.equal([
      {
        apexCode: "System.abortJob('08e9b00000KiFENAA3');",
      },
    ]);
    expect(result).to.be.ok;
    expect(result.length).to.equal(1);
    expect(result[0].jobId).to.equal('08e9b00000KiFENAA3');
    expect(result[0].status).to.equal('STOPPED');
  });
});
