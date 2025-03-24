import { expect } from 'chai';
import { AnyJson } from '@salesforce/ts-types';
import { ExecuteService } from '@salesforce/apex-node';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubPrompter } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import JscApexScheduleStop from '../../../../src/commands/jsc/apex/schedule/stop.js';
import JscApexScheduleExport from '../../../../src/commands/jsc/apex/schedule/export.js';
import ApexSchedulerMocks from '../../../mock-utils/apexSchedulerMocks.js';

describe('jsc apex schedule', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let promptStub: ReturnType<typeof stubPrompter>;
  let anonApexMocks: ApexSchedulerMocks;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    promptStub = stubPrompter($$.SANDBOX);
    anonApexMocks = new ApexSchedulerMocks();
    $$.fakeConnectionRequest = mockQueryResults;
  });

  afterEach(async () => {
    process.removeAllListeners();
  });

  function mockQueryResults(request: AnyJson): Promise<AnyJson> {
    return anonApexMocks.mockQueryResults(request);
  }

  it('stops scheduled job filtered by cron trigger id', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run([
      '--target-org',
      testOrg.username,
      '--id',
      '08e7a00000VlWl2AAF',
      '--no-prompt',
    ]);

    // Assert
    expect(executeServiceStub.args.flat()).to.deep.equal([
      {
        apexCode: "System.abortJob('08e7a00000VlWl2AAF');",
      },
    ]);
    expect(result).to.be.ok;
    expect(result.length).to.equal(1);
    expect(result[0].jobId).to.equal('08e7a00000VlWl2AAF');
    expect(result[0].status).to.equal('STOPPED');
    expect(sfCommandStubs.logSuccess.args.flat()).to.deep.equal(['Successfully stopped 1 jobs.']);
    expect(promptStub.confirm.callCount).to.equal(0);
  });

  it('stops no scheduled jobs when called with unknown cron trigger id', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run([
      '--target-org',
      testOrg.username,
      '--id',
      '08e000000000000AAA',
      '--no-prompt',
    ]);

    // Assert
    expect(executeServiceStub.callCount).to.equal(0);
    expect(result.length).to.equal(0);
  });

  it('stops all scheduled jobs when called without parameters', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run(['--target-org', testOrg.username, '--no-prompt']);

    // Assert
    expect(executeServiceStub.args.flat()).to.deep.equal([
      {
        apexCode: "System.abortJob('08e7a00000VlWl2AAF');",
      },
      {
        apexCode: "System.abortJob('08e7a00000cohZpAAI');",
      },
      {
        apexCode: "System.abortJob('08e9Q0000051cl7QAA');",
      },
      {
        apexCode: "System.abortJob('08e9Q00000G1e5lQAB');",
      },
      {
        apexCode: "System.abortJob('08e9Q00000GoRITQA3');",
      },
    ]);
    expect(result.length).to.equal(5);
    expect(result[0].jobId).to.equal('08e7a00000VlWl2AAF');
    expect(result[1].jobId).to.equal('08e7a00000cohZpAAI');
    expect(result[2].jobId).to.equal('08e9Q0000051cl7QAA');
    expect(result[3].jobId).to.equal('08e9Q00000G1e5lQAB');
    expect(result[4].jobId).to.equal('08e9Q00000GoRITQA3');
    expect(sfCommandStubs.logSuccess.args.flat()).to.deep.equal(['Successfully stopped 5 jobs.']);
  });

  it('stops scheduled jobs filtered by a particular class name', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run([
      '--target-org',
      testOrg.username,
      '--apex-class-name',
      'LicensingStatusRecalculation',
      '--no-prompt',
    ]);

    // Assert
    expect(executeServiceStub.args.flat()).to.deep.equal([
      {
        apexCode: "System.abortJob('08e9Q00000G1e5lQAB');",
      },
    ]);
    expect(result.length).to.equal(1);
    expect(result[0].jobId).to.equal('08e9Q00000G1e5lQAB');
    expect(sfCommandStubs.logSuccess.args.flat()).to.deep.equal(['Successfully stopped 1 jobs.']);
  });

  it('stops scheduled jobs filtered by job name', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );

    // Act
    const result = await JscApexScheduleStop.run([
      '--target-org',
      testOrg.username,
      '--name',
      'Auto Case Reminder',
      '--no-prompt',
    ]);

    // Assert
    expect(executeServiceStub.args.flat()).to.deep.equal([
      {
        apexCode: "System.abortJob('08e9Q00000GoRITQA3');",
      },
    ]);
    expect(result.length).to.equal(1);
    expect(result[0].jobId).to.equal('08e9Q00000GoRITQA3');
    expect(sfCommandStubs.logSuccess.args.flat()).to.deep.equal(['Successfully stopped 1 jobs.']);
  });

  it('prompts for confirmation without --no-prompt', async () => {
    // Arrange
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(anonApexMocks.SCHEDULE_STOP_SUCCESS);
    promptStub.confirm.resolves(true);

    // Act
    const result = await JscApexScheduleStop.run(['--target-org', testOrg.username, '--name', 'Auto Case Reminder']);

    // Assert
    expect(promptStub.confirm.callCount).to.equal(1);
    expect(result.length).to.equal(1);
  });

  it('aborts command with --no-prompt if user denies prompt', async () => {
    // Arrange
    const executeServiceStub = $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
      anonApexMocks.SCHEDULE_STOP_SUCCESS
    );
    promptStub.confirm.resolves(false);

    // Act
    try {
      await JscApexScheduleStop.run(['--target-org', testOrg.username, '--name', 'Auto Case Reminder']);
      expect.fail('Expected error, but succeeded');
    } catch (err) {
      assertError(err, 'AbortCommandError', 'Aborted by user. No jobs were stopped.');
    }

    // Assert
    expect(promptStub.confirm.callCount).to.equal(1);
    expect(executeServiceStub.callCount).to.equal(0);
  });

  it('exports all scheduled jobs without filters', async () => {
    // Act
    const result = await JscApexScheduleExport.run(['--target-org', testOrg.username]);

    // Assert
    expect(result.length).to.equal(anonApexMocks.ALL_JOBS.records.length);
    expect(result[0].CronTriggerId).to.equal('08e7a00000VlWl2AAF');
    expect(result[0].CronExpression).to.equal('0 0 5 ? * * *');
    expect(result[0].ApexClassName).to.equal('AutoContractRenewalJob');
    expect(result[0].TimesTriggered).to.equal(1059);
  });

  it('prints all exported scheduled jobs to output table', async () => {
    // Act
    await JscApexScheduleExport.run(['--target-org', testOrg.username]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(1);
    const tableArgs = sfCommandStubs.table.args.flat()[0];
    expect(tableArgs.data.length).to.equal(5);
    tableArgs.data.forEach((tableRow, index) => {
      const originalRecord = anonApexMocks.ALL_JOBS.records[index];
      expect(tableRow).to.deep.equal({
        CronTriggerId: originalRecord.CronTriggerId,
        CronJobDetailName: originalRecord.CronTrigger.CronJobDetail.Name,
        ApexClassName: originalRecord.ApexClass.Name,
        CronExpression: originalRecord.CronTrigger.CronExpression,
        CronTriggerState: originalRecord.CronTrigger.State,
        NextFireTime: new Date(originalRecord.CronTrigger.NextFireTime),
        StartTime: new Date(originalRecord.CronTrigger.StartTime),
        TimesTriggered: originalRecord.CronTrigger.TimesTriggered,
      });
    });
  });

  it('exports scheduled jobs filtered by apex class', async () => {
    // Act
    const result = await JscApexScheduleExport.run([
      '--target-org',
      testOrg.username,
      '--apex-class-name',
      'DisableInactiveUsersJob',
    ]);

    // Assert
    expect(result.length).to.equal(1);
    expect(result[0].CronTriggerId).to.equal('08e7a00000cohZpAAI');
    expect(result[0].ApexClassName).to.equal('DisableInactiveUsersJob');
  });
});

function assertError(err: unknown, expectedName: string, expectedMsg: string) {
  if (err instanceof SfError) {
    expect(err.name).to.equal(expectedName);
    expect(err.message).to.contain(expectedMsg);
  } else {
    expect.fail('Expected SfError, but got: ' + JSON.stringify(err));
  }
}
