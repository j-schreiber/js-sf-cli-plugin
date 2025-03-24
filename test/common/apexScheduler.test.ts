/* eslint-disable camelcase */
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { ExecuteService } from '@salesforce/apex-node';
import { AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import ApexScheduleService from '../../src/common/apex-scheduler/apexScheduleService.js';
import ApexSchedulerMocks from '../mock-utils/apexSchedulerMocks.js';

describe('apex scheduler', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let anonApexMocks: ApexSchedulerMocks;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    anonApexMocks = new ApexSchedulerMocks();
    $$.fakeConnectionRequest = mockQueryResults;
  });

  function mockQueryResults(request: AnyJson): Promise<AnyJson> {
    return anonApexMocks.mockQueryResults(request);
  }

  describe('start job', () => {
    it('uses apex class name, job name and cron expression to schedule apex', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);

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

    it('schedule job fails because job with same name is already scheduled', async () => {
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

    it('schedule job fails with invalid cron expression', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
        anonApexMocks.INVALID_CRON_EXPRESSION_ERROR
      );

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

    it('emits log event when successfully scheduling a job', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const logListener = $$.SANDBOX.stub();
      const diagnosticsListener = $$.SANDBOX.stub();
      scheduler.addListener('logOutput', logListener);
      scheduler.addListener('diagnostics', diagnosticsListener);

      // Act
      await scheduler.scheduleJob({
        apexClassName: 'MyTestClass',
        jobName: 'My Test Job',
        cronExpression: '0 0 0 1 ? * * *',
      });

      // Assert
      expect(logListener.callCount).to.equal(1);
      expect(logListener.args.flat()[0]).to.deep.contain({ message: anonApexMocks.SCHEDULE_START_SUCCESS.logs });
      expect(diagnosticsListener.callCount).to.equal(0);
    });

    it('emits trace events when failing to schedule a job', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.ALREADY_SCHEDULED_ERROR);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const logListener = $$.SANDBOX.stub();
      const diagnosticsListener = $$.SANDBOX.stub();
      scheduler.addListener('logOutput', logListener);
      scheduler.addListener('diagnostics', diagnosticsListener);

      // Act
      try {
        await scheduler.scheduleJob({
          apexClassName: 'MyTestClass',
          jobName: 'My Test Job',
          cronExpression: '0 0 0 1 ? * * *',
        });
      } catch (err) {
        // we're good, only interested in events
      }

      // Assert
      expect(logListener.callCount).to.equal(1);
      expect(logListener.args.flat()[0]).to.deep.contain({ message: anonApexMocks.ALREADY_SCHEDULED_ERROR.logs });
      expect(diagnosticsListener.callCount).to.equal(1);
      expect(diagnosticsListener.args.flat()[0]).to.deep.contain({
        message: JSON.stringify(anonApexMocks.ALREADY_SCHEDULED_ERROR.diagnostic, null, 2),
      });
    });
  });

  describe('stop job', () => {
    it('emits trace events when failing to stop a job', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.JOB_ALREADY_ABORTED);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const logListener = $$.SANDBOX.stub();
      const diagnosticsListener = $$.SANDBOX.stub();
      scheduler.addListener('logOutput', logListener);
      scheduler.addListener('diagnostics', diagnosticsListener);

      // Act
      try {
        await scheduler.stopJobs(['08e9b00000Kz6hmAAB']);
      } catch (err) {
        // we're good, only interested in events
      }

      // Assert
      expect(logListener.callCount).to.equal(1);
      expect(logListener.args.flat()[0]).to.deep.contain({ message: anonApexMocks.JOB_ALREADY_ABORTED.logs });
      expect(diagnosticsListener.callCount).to.equal(1);
      expect(diagnosticsListener.args.flat()[0]).to.deep.contain({
        message: JSON.stringify(anonApexMocks.JOB_ALREADY_ABORTED.diagnostic, null, 2),
      });
    });
  });

  describe('find jobs', () => {
    it('queries for all scheduled apex cron triggers when no filters are provided', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({});

      // Assert
      expect(allJobs.length).to.equal(5);
      expect(allJobs[0].CronJobDetailName).to.equal('Auto Contract Renewal');
      expect(allJobs[1].CronJobDetailName).to.equal('Disable Inactive Users');
    });

    it('filters scheduled apex cron triggers by apex class name', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({ apexClassName: 'AutoContractRenewalJob' });

      // Assert
      expect(allJobs.length).to.equal(1);
      expect(allJobs[0].CronJobDetailName).to.equal('Auto Contract Renewal');
    });

    it('filters scheduled apex cron triggers on exact job detail name', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({ jobName: 'Disable Inactive Users' });

      // Assert
      expect(allJobs.length).to.equal(1);
      expect(allJobs[0].ApexClassName).to.equal('DisableInactiveUsersJob');
    });

    it('filters scheduled apex cron triggers on part of job detail name', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({ jobName: 'Auto' });

      // Assert
      expect(allJobs.length).to.equal(2);
      expect(allJobs[0].ApexClassName).to.equal('AutoContractRenewalJob');
      expect(allJobs[1].ApexClassName).to.equal('CaseReminderJob');
    });

    it('filters scheduled apex cron triggers on apex class and job name', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({ jobName: 'Auto', apexClassName: 'AutoContractRenewalJob' });

      // Assert
      expect(allJobs.length).to.equal(1);
      expect(allJobs[0].ApexClassName).to.equal('AutoContractRenewalJob');
    });

    it('filters scheduled apex cron triggers on apex class and job name with impossible combination', async () => {
      // Act
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const allJobs = await scheduler.findJobs({ jobName: 'Auto', apexClassName: 'DisableInactiveUsersJob' });

      // Assert
      expect(allJobs.length).to.equal(0);
    });
  });

  describe('manage jobs', () => {
    const expectedScheduleResult1 = {
      jobId: '08e9b00000KiFENAA3',
      cronExpression: '0 0 0 1 * * *',
      jobName: 'Job name with spaces',
      apexClassName: 'SchedulableClass1',
      nextFireTime: new Date('2025-01-27T00:05:00.000Z'),
    };

    const expectedAutoRenewalResult = {
      jobId: '08e9b00000KiFENAA3',
      cronExpression: '0 0 4 ? * * *',
      jobName: 'Auto Contract Renewal',
      apexClassName: 'AutoContractRenewalJob',
      nextFireTime: new Date('2025-01-27T00:05:00.000Z'),
    };

    it('starts new apex job from job management config and leaves existing jobs untouched', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const existingJobs = await scheduler.findJobs({});

      // Act
      const result = await scheduler.manageJobs({
        options: { stop_other_jobs: false, restart_all_jobs: false },
        jobs: { 'Job name with spaces': { class: 'SchedulableClass1', expression: '0 0 0 1 * * *' } },
      });

      // Assert
      expect(result.started).to.deep.equal([expectedScheduleResult1]);
      expect(result.stopped).to.deep.equal([]);
      expect(result.untouched).to.deep.equal(existingJobs);
    });

    it('skips new job in config that matches already running job exactly', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const existingJobs = await scheduler.findJobs({});

      // Act
      const result = await scheduler.manageJobs({
        options: { stop_other_jobs: false, restart_all_jobs: false },
        jobs: {
          'Job name with spaces': { class: 'SchedulableClass1', expression: '0 0 0 1 * * *' },
          'Auto Contract Renewal': { class: 'AutoContractRenewalJob', expression: '0 0 5 ? * * *' },
        },
      });

      // Assert
      expect(result.started).to.deep.equal([expectedScheduleResult1]);
      expect(result.stopped).to.deep.equal([]);
      expect(result.untouched).to.deep.equal(existingJobs);
    });

    it('restarts running job with different cron expression', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const existingJobs = await scheduler.findJobs({});

      // Act
      const result = await scheduler.manageJobs({
        options: { stop_other_jobs: false, restart_all_jobs: false },
        jobs: {
          'Auto Contract Renewal': { class: 'AutoContractRenewalJob', expression: '0 0 4 ? * * *' },
        },
      });

      // Assert
      expect(result.started).to.deep.equal([expectedAutoRenewalResult]);
      const originalAutoRenewal = existingJobs.shift();
      expect(result.stopped).to.deep.equal([originalAutoRenewal]);
      expect(result.untouched).to.deep.equal(existingJobs);
    });

    it('stops all running jobs except jobs that match input config when stop other jobs is true', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const existingJobs = await scheduler.findJobs({});

      // Act
      const result = await scheduler.manageJobs({
        options: { stop_other_jobs: true, restart_all_jobs: false },
        jobs: {
          'Auto Contract Renewal': { class: 'AutoContractRenewalJob', expression: '0 0 5 ? * * *' },
        },
      });

      // Assert
      expect(result.started).to.deep.equal([]);
      const originalAutoRenewal = existingJobs.shift();
      expect(result.stopped).to.deep.equal(existingJobs);
      expect(result.untouched).to.deep.equal([originalAutoRenewal]);
    });

    it('leaves all jobs untouched with config that matches running jobs exactly', async () => {
      // Arrange
      $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_START_SUCCESS);
      const scheduler = new ApexScheduleService(await testOrg.getConnection());
      const existingJobs = await scheduler.findJobs({});

      // Act
      const result = await scheduler.manageJobs({
        options: { stop_other_jobs: true, restart_all_jobs: false },
        jobs: {
          'Disable Inactive Users': { class: 'DisableInactiveUsersJob', expression: '0 12 15 ? * * *' },
          'Auto Contract Renewal': { class: 'AutoContractRenewalJob', expression: '0 0 5 ? * * *' },
          'Auto Case Reminder': { class: 'CaseReminderJob', expression: '0 0 1 ? * * *' },
          'Asset Licensing Status': { class: 'LicensingStatusRecalculation', expression: '0 0 1 ? * * *' },
          'Delete old Asset States': { class: 'AssetMonitoringStateRetentionBatch', expression: '0 0 1 ? * * *' },
        },
      });

      // Assert
      expect(result.started).to.deep.equal([]);
      expect(result.stopped).to.deep.equal([]);
      expect(result.untouched).to.deep.equal(existingJobs);
    });
  });
});
