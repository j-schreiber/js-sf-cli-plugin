import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { SfError } from '@salesforce/core';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscDataExportResult } from '../../../../src/commands/jsc/data/export.js';
import { MigrationPlanObjectQueryResult } from '../../../../src/types/migrationPlanObjectData.js';

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
  });

  afterEach(() => {
    // default export
    fs.rmSync('exports', { recursive: true, force: true });
  });

  describe('data export', () => {
    it('exports data from valid plan file', () => {
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

    it('exports no data from plan file that has binds that resolve to zero records', () => {
      // Act
      const result = execCmd<JscDataExportResult>(
        `jsc:data:export --plan ${path.join(
          'export-plans',
          'plan-for-empty-bind.yml'
        )} --source-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      expect(result!.exports.length).to.equal(3);
      const userResult = result!.exports[0];
      expect(userResult.isSuccess).to.equal(true, 'user result is success');
      expect(userResult.totalSize).to.equal(0, 'user result total size');
      expect(userResult.files.length).to.equal(0, 'user result created files');
      expect(userResult.executedFullQueryStrings.length).to.equal(1, 'user result queries executed');
      const accountResult = result!.exports[1];
      assertEmptyExportsForResult(accountResult);
      const contactResult = result!.exports[2];
      assertEmptyExportsForResult(contactResult);
    });

    it('exports no data with --validate-only flag but returns object array in --json output', () => {
      // Act
      const result = execCmd<JscDataExportResult>(
        `jsc:data:export --plan ${path.join(
          'export-plans',
          'plan-for-empty-bind.yml'
        )} --source-org ${scratchOrgAlias} --json --validate-only`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      // details of exports are unit tested
      expect(result!.exports.length).to.equal(3);
    });

    it('validates bind variable with --validate-only flag and returns error details in --json output', () => {
      // Act
      const planPath = path.join('export-plans', 'plan-with-invalid-bind.yml');
      const result = execCmd<SfError>(
        `jsc:data:export --plan ${planPath} --source-org ${scratchOrgAlias} --validate-only --json`,
        {
          ensureExitCode: 1,
        }
      ).jsonOutput;

      // Assert
      expect(result?.message).to.contain(
        "Invalid query syntax: SELECT Id FROM Contact WHERE InvalidParentId__c IN ('') AND InvalidParentId__c != NULL"
      );
    });
  });

  function assertEmptyExportsForResult(objectResult: MigrationPlanObjectQueryResult) {
    expect(objectResult.isSuccess).to.equal(true, 'result is success');
    expect(objectResult.totalSize).to.equal(0, 'result total size');
    expect(objectResult.files.length).to.equal(0, 'result created files');
    expect(objectResult.executedFullQueryStrings.length).to.equal(0, 'result queries executed');
  }

  function parseExportedRecords(filePath: string): QueryResult<Record> {
    return JSON.parse(
      fs.readFileSync(`${path.join(session.dir, projectName, filePath)}`, 'utf8')
    ) as QueryResult<Record>;
  }
});
