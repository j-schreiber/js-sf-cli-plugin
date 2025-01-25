import { expect } from 'chai';
import { ExecuteService } from '@salesforce/apex-node';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import ApexScheduleService from '../../src/common/apex-scheduler/apexScheduleService.js';
import AnonymousApexMocks from '../mock-utils/anonApexMocks.js';

describe('apex scheduler', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let anonApexMocks: AnonymousApexMocks;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    anonApexMocks = new AnonymousApexMocks();
  });

  it('uses apex class name, job name and cron expression to schedule apex', async () => {
    // Arrange
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SUCCESS);

    // Act
    const scheduler = new ApexScheduleService(await testOrg.getConnection());
    const scheduleResult = await scheduler.scheduleJob({
      apexClassName: 'MyTestClass',
      jobName: 'My Test Job',
      cronExpression: '0 0 0 1 ? * * *',
    });

    // Assert
    expect(scheduleResult.jobId).equals('08e9b00000KiFENAA3');
  });
});
