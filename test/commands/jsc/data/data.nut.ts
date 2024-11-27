import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscDataExportResult } from '../../../../src/commands/jsc/data/export.js';

const scratchOrgAlias = 'TestTargetOrg';
const projectName = 'test-sfdx-project';

describe('jsc data NUTs*', () => {
  let session: TestSession;
  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'dataNutsProject',
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
    execCmd(`data:import:tree -p ${path.join('data', 'plans', 'minimal-plan.json')} -o ${scratchOrgAlias} --json`, {
      ensureExitCode: 0,
      cli: 'sf',
    });
  });

  after(async () => {
    await session?.clean();
    fs.rmSync('exports', { recursive: true, force: true });
  });

  describe('data export', () => {
    it('export data from valid plan file', () => {
      // Act
      const result = execCmd<JscDataExportResult>(
        `jsc:data:export --plan ${path.join('export-plans', 'test-plan.yml')} --source-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      expect(result).to.not.be.undefined;
      expect(result?.exports.length).to.equal(4);
      expect(result?.exports[0].isSuccess).to.equal(true, 'is success for: ' + JSON.stringify(result?.exports[0]));
      expect(result?.exports[0].totalSize).to.equal(2, 'total size for: ' + JSON.stringify(result?.exports[0]));
      expect(result?.exports[0].files.length).to.equal(1, 'number of files for: ' + JSON.stringify(result?.exports[0]));
      const actuallyExportedAccounts = parseExportedRecords(result!.exports[0].files[0]);
      expect(actuallyExportedAccounts.records.length).to.equal(2, 'length of actually exported accounts');
      expect(result?.exports[1].isSuccess).to.equal(true, 'is success for: ' + JSON.stringify(result?.exports[1]));
      expect(result?.exports[1].totalSize).to.equal(1, 'total size for: ' + JSON.stringify(result?.exports[1]));
      expect(result?.exports[1].files.length).to.equal(1, 'number of files for: ' + JSON.stringify(result?.exports[1]));
      const actuallyExportedContacts = parseExportedRecords(result!.exports[1].files[0]);
      expect(actuallyExportedContacts.records.length).to.equal(1, 'length of actually exported contacts');
    });
  });

  function parseExportedRecords(filePath: string): QueryResult<Record> {
    return JSON.parse(
      fs.readFileSync(`${path.join(session.dir, projectName, filePath)}`, 'utf8')
    ) as QueryResult<Record>;
  }
});
