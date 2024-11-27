import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscDataExportResult } from '../../../../src/commands/jsc/data/export.js';

const scratchOrgAlias = 'TestTargetOrg';

describe('jsc data NUTs*', () => {
  let session: TestSession;
  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'dataNutsProject',
        sourceDir: path.join('test', 'data', 'test-sfdx-project'),
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
  });

  after(async () => {
    await session?.clean();
    fs.rmSync('exports', { recursive: true, force: true });
  });

  describe('data export', () => {
    it('export data from valid plan file', () => {
      // Arrange

      // Act
      const result = execCmd<JscDataExportResult>(
        `jsc:data:export --plan export-plans/test-plan.yml --source-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;

      // Assert
      expect(result).to.not.be.undefined;
      expect(result?.result.exports.length).to.equal(4);
    });
  });
});
