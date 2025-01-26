import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscApexScheduleStartResult } from '../../../../src/commands/jsc/apex/schedule/start.js';

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

  describe('start', () => {
    it('schedules an apex class with valid cron expression and returns the cron job details', () => {
      // Act
      const result = execCmd<JscApexScheduleStartResult>(
        `jsc:apex:schedule:start --apex-class-name TestJob --cron-expression "0 0 1 * * ?" --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      expect(result).to.not.be.undefined;
      expect(result!.jobId).to.not.be.empty;
      expect(result!.jobId.startsWith('08e')).to.equal(true, 'is a valid cron trigger id');
      expect(result!.nextFireTime).to.not.be.empty;
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
  });
});
