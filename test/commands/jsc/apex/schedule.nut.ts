import path from 'node:path';
import { assert, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscApexScheduleStartResult } from '../../../../src/commands/jsc/apex/schedule/start.js';
import { JscApexScheduleStopResult } from '../../../../src/commands/jsc/apex/schedule/stop.js';
import { AsyncApexJobFlat } from '../../../../src/types/scheduledApexTypes.js';
import { ManageJobsResult } from '../../../../src/common/apex-scheduler/apexScheduleService.js';

const scratchOrgAlias = 'TestTargetOrg';
const projectName = 'test-sfdx-project';

describe('jsc apex schedule NUTs', () => {
  let session: TestSession;

  const expectedJobsFromConfig = [
    { apexClassName: 'TestJob', jobName: 'Name of my job', cronExpression: '0 0 1 * * ?' },
    { apexClassName: 'TestJob', jobName: 'My job 2', cronExpression: '0 0 2 * * ?' },
    { apexClassName: 'TestSchedulable2', jobName: 'Yet another job', cronExpression: '0 0 1 * * ?' },
    { apexClassName: 'TestSchedulable2', jobName: 'or_name_job_like_this', cronExpression: '0 0 1 * * ?' },
    { apexClassName: 'TestSchedulable3', jobName: 'TestSchedulable3', cronExpression: '0 0 1 * * ?' },
  ];

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'scheduleNutsProject',
        sourceDir: path.join('test', 'data', projectName),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          alias: scratchOrgAlias,
          config: path.join('config', 'default-scratch-def.json'),
          setDefault: false,
          duration: 1,
        },
      ],
    });
    execCmd(`project:deploy:start -o ${scratchOrgAlias}`, {
      ensureExitCode: 0,
      cli: 'sf',
    });
  });

  after(async () => {
    await session?.clean();
  });

  afterEach(async () => {
    execCmd<JscApexScheduleStopResult[]>(`jsc:apex:schedule:stop --target-org ${scratchOrgAlias} --no-prompt --json`, {
      ensureExitCode: 0,
    });
  });

  it('schedules an apex class with valid cron expression and returns the cron job details', () => {
    // Act
    const result = execCmd<JscApexScheduleStartResult>(
      `jsc:apex:schedule:start --apex-class-name TestJob --cron-expression "0 0 1 * * ?" --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;
    const exportResult = execCmd<AsyncApexJobFlat[]>(
      `jsc:apex:schedule:export --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    expect(result).to.not.be.undefined;
    expect(result!.jobId).to.not.be.empty;
    expect(result!.jobId.startsWith('08e')).to.equal(true, 'is a valid cron trigger id');
    expect(result!.nextFireTime).to.not.be.empty;
    expect(exportResult).to.not.be.undefined;
    expect(exportResult?.length).to.equal(1);
    expect(exportResult![0].CronTriggerId).to.equal(result!.jobId);
  });

  it('throws error when input is an invalid apex class', () => {
    // Act
    const result = execCmd<JscApexScheduleStartResult>(
      `jsc:apex:schedule:start --apex-class-name SomeNoneExistingClass --cron-expression "0 0 1 * * ?" --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 1 }
    ).jsonOutput!;

    // Assert
    expect(result.name).to.equal('GenericCompileFailError');
    expect(result.message).to.contain('Invalid type: SomeNoneExistingClass');
  });

  it('successfully stops a job by id that was returned from schedule start', () => {
    // Arrange
    const startResult = execCmd<JscApexScheduleStartResult>(
      `jsc:apex:schedule:start --apex-class-name TestJob --name "To Be Stopped" --cron-expression "0 0 1 * * ?" --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Act
    const stopResult = execCmd<JscApexScheduleStopResult[]>(
      `jsc:apex:schedule:stop --id ${startResult?.jobId} --target-org ${scratchOrgAlias} --no-prompt --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;
    const exportResult = execCmd<AsyncApexJobFlat[]>(
      `jsc:apex:schedule:export --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    assert.isDefined(stopResult);
    assert.isDefined(exportResult);
    expect(stopResult.length).to.equal(1);
    expect(stopResult[0].jobId).to.equal(startResult?.jobId);
    expect(exportResult.length).to.equal(0, 'jobs exported after stop');
  });

  it('starts all jobs from a valid config', () => {
    // Act
    const manageResult = execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    assert.isDefined(manageResult);
    expect(manageResult.started.length).to.equal(5);
    const startedJobs = extractTestablePropsFromStarted(manageResult);
    expect(startedJobs).to.have.deep.members(expectedJobsFromConfig);
    expect(manageResult.stopped).to.deep.equal([]);
    expect(manageResult.untouched).to.deep.equal([]);
  });

  it('stops all jobs with a config that specifies no jobs and is stop_other_jobs true', () => {
    // Arrange
    execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    );

    // Act
    const manageResult = execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/empty-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    assert.isDefined(manageResult);
    expect(manageResult.started).to.deep.equal([]);
    expect(manageResult.stopped.length).to.equal(5);
    const stoppedJobs = extractTestableProbsFromDetails(manageResult.stopped);
    expect(stoppedJobs).to.have.deep.members(expectedJobsFromConfig);
    expect(manageResult.untouched).to.deep.equal([]);
  });

  it('starts, updates, and stops jobs from a modified config', () => {
    // Arrange
    execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    );

    // Act
    const manageResult = execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/updated-scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    assert.isDefined(manageResult);
    expect(manageResult.started.length).to.equal(3);
    const startedJobs = extractTestablePropsFromStarted(manageResult);
    expect(startedJobs).to.have.deep.members([
      { apexClassName: 'TestSchedulable2', jobName: 'or_name_job_like_this', cronExpression: '0 0 2 * * ?' },
      { apexClassName: 'TestSchedulable3', jobName: 'TestSchedulable3', cronExpression: '0 0 2 * * ?' },
      { apexClassName: 'TestJob', jobName: 'TestJob', cronExpression: '0 0 3 * * ?' },
    ]);
    const stoppedJobs = extractTestableProbsFromDetails(manageResult.stopped);
    expect(stoppedJobs).to.have.deep.members([
      { apexClassName: 'TestSchedulable2', jobName: 'or_name_job_like_this', cronExpression: '0 0 1 * * ?' },
      { apexClassName: 'TestSchedulable3', jobName: 'TestSchedulable3', cronExpression: '0 0 1 * * ?' },
    ]);
    const unchangedJobs = extractTestableProbsFromDetails(manageResult.untouched);
    expect(unchangedJobs).to.have.deep.members([
      { apexClassName: 'TestJob', jobName: 'Name of my job', cronExpression: '0 0 1 * * ?' },
      { apexClassName: 'TestJob', jobName: 'My job 2', cronExpression: '0 0 2 * * ?' },
      { apexClassName: 'TestSchedulable2', jobName: 'Yet another job', cronExpression: '0 0 1 * * ?' },
    ]);
  });

  it('has all previously started jobs as unchanged, when called with same config subsequently', () => {
    // Arrange
    execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    );

    // Act
    const manageResult = execCmd<ManageJobsResult>(
      `jsc:apex:schedule:manage --config-file jobs/scheduled-jobs.yaml --target-org ${scratchOrgAlias} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    // Assert
    assert.isDefined(manageResult);
    expect(manageResult.started).to.deep.equal([]);
    expect(manageResult.stopped).to.deep.equal([]);
    const unchangedJobs = extractTestableProbsFromDetails(manageResult.untouched);
    expect(unchangedJobs).to.have.deep.members(expectedJobsFromConfig);
  });
});

function extractTestablePropsFromStarted(
  result: ManageJobsResult
): Array<{ apexClassName?: string; jobName?: string; cronExpression?: string }> {
  return result.started.map(({ apexClassName, jobName, cronExpression }) => ({
    apexClassName,
    jobName,
    cronExpression,
  }));
}

function extractTestableProbsFromDetails(
  jobDetails: AsyncApexJobFlat[]
): Array<{ apexClassName: string; jobName: string; cronExpression?: string }> {
  return jobDetails.map(({ ApexClassName, CronJobDetailName, CronExpression }) => ({
    apexClassName: ApexClassName,
    jobName: CronJobDetailName,
    cronExpression: CronExpression,
  }));
}
