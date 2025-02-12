import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscApexScheduleStartResult } from '../../../../src/commands/jsc/apex/schedule/start.js';
import { JscApexScheduleStopResult } from '../../../../src/commands/jsc/apex/schedule/stop.js';
import { AsyncApexJobFlat } from '../../../../src/types/scheduledApexTypes.js';

const scratchOrgAlias = 'TestTargetOrg';
const projectName = 'test-sfdx-project';

describe('jsc apex schedule NUTs', () => {
  let session: TestSession;
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
    expect(stopResult).to.not.be.undefined;
    expect(stopResult?.length).to.equal(1);
    expect(stopResult![0].jobId).to.equal(startResult?.jobId);
    expect(exportResult).to.not.be.undefined;
    expect(exportResult?.length).to.equal(0, 'jobs exported after stop');
  });
});
