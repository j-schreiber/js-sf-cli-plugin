import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { ExecuteService } from '@salesforce/apex-node';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import ApexScheduleService from '../../src/common/apex-scheduler/apexScheduleService.js';
import AnonymousApexMocks from '../mock-utils/anonApexMocks.js';
import QueryRunner from '../../src/common/utils/queryRunner.js';

describe('apex scheduler', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let anonApexMocks: AnonymousApexMocks;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    anonApexMocks = new AnonymousApexMocks();
    $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords').callsFake(anonApexMocks.queryStub);
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
    const expectedNextFireTime = new Date(anonApexMocks.JOB_DETAILS.records[0].CronTrigger.NextFireTime);
    expect(scheduleResult.nextFireTime).deep.equals(expectedNextFireTime);
  });

  it('apex execution fails because job with same name is already scheduled', async () => {
    // Arrange
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.ALREADY_SCHEDULED_ERROR);

    // Act
    const scheduler = new ApexScheduleService(await testOrg.getConnection());
    try {
      await scheduler.scheduleJob({
        apexClassName: 'MyTestClass',
        jobName: 'My Test Job',
        cronExpression: '0 0 0 1 ? * * *',
      });
      expect.fail('Expected exception, but succeeded');
    } catch (e) {
      if (e instanceof SfError) {
        expect(e.name).to.equal('SystemAsyncExceptionError');
        expect(e.message).to.equal(anonApexMocks.ALREADY_SCHEDULED_ERROR.diagnostic![0].exceptionMessage);
      } else {
        expect.fail('Expected SfError');
      }
    }
  });

  it('apex execution fails with invalid cron expression', async () => {
    // Arrange
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.INVALID_CRON_EXPRESSION_ERROR);

    // Act
    const scheduler = new ApexScheduleService(await testOrg.getConnection());
    try {
      await scheduler.scheduleJob({
        apexClassName: 'MyTestClass',
        jobName: 'My Test Job',
        cronExpression: '0 1 ABC',
      });
      expect.fail('Expected exception, but succeeded');
    } catch (e) {
      if (e instanceof SfError) {
        expect(e.name).to.equal('InvalidCronExpressionError');
        expect(e.message).to.contain(
          'Illegal cron expression format (java.lang.StringIndexOutOfBoundsException: begin 0, end 3, length 1)',
          'Apex execution exception message'
        );
        expect(e.message).to.contain('0 1 ABC', 'original cronExpression input');
      } else {
        expect.fail('Expected SfError');
      }
    }
  });

  it('queries for all scheduled apex cron triggers when no filters are provided', async () => {
    // Act
    const scheduler = new ApexScheduleService(await testOrg.getConnection());
    const allJobs = await scheduler.findJobs({});

    // Arrange
    expect(allJobs.length).to.equal(5);
    expect(allJobs[0].CronTrigger.CronJobDetail.Name).to.equal('Auto Contract Renewal');
    expect(allJobs[1].CronTrigger.CronJobDetail.Name).to.equal('Disable Inactive Users');
  });
});
