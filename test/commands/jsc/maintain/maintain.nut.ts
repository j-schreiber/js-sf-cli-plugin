import fs from 'node:fs';
import path from 'node:path';
import { expect, assert } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscMaintainFieldUsageAnalyseResult } from '../../../../src/commands/jsc/maintain/field-usage/analyse.js';
import { JscMaintainExportObsoleteFlowsResult } from '../../../../src/commands/jsc/maintain/flow-export/obsolete.js';
import { JscMaintainExportUnusedFlowsResult } from '../../../../src/commands/jsc/maintain/flow-export/unused.js';

const scratchOrgAlias = 'TestTargetOrg';
const projectName = 'test-sfdx-project';
const outputDir = path.join('tmp', 'maintain');

describe('jsc maintain NUTs*', () => {
  let session: TestSession;
  let sessionOutputPath: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'generalMaintainProject',
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
    sessionOutputPath = path.join(session.dir, projectName, outputDir);
    execCmd(`data:import:tree -p ${path.join('data', 'plans', 'minimal-plan.json')} -o ${scratchOrgAlias} --json`, {
      ensureExitCode: 0,
      cli: 'sf',
    });
  });

  after(async () => {
    await session?.clean();
  });

  afterEach(() => {
    fs.rmSync(sessionOutputPath, { recursive: true, force: true });
  });

  describe('field-usage analyse', () => {
    it('successfully analyses multiple valid sobjects with and without data', () => {
      // Act
      const execResult = execCmd<JscMaintainFieldUsageAnalyseResult>(
        `jsc:maintain:field-usage:analyse --target-org ${scratchOrgAlias} --sobject Account --sobject Contact --sobject Lead --json`,
        { ensureExitCode: 0 }
      );

      // Assert
      const result = execResult.jsonOutput?.result;
      assert.isDefined(result);
      assert.isDefined(result.sobjects['Account']);
      // the default scratch org is created with 1 account (data imports 3). Lets see how stable this is
      expect(result.sobjects['Account'].totalRecords).to.equal(4);
      assert.isDefined(result.sobjects['Contact']);
      expect(result.sobjects['Contact'].totalRecords).to.equal(2);
      assert.isDefined(result.sobjects['Lead']);
      expect(result.sobjects['Lead'].totalRecords).to.equal(0);
    });

    it('successfully analyses valid sobject with check-defaults flag', () => {
      // Act
      const result = execCmd<JscMaintainFieldUsageAnalyseResult>(
        `jsc:maintain:field-usage:analyse --target-org ${scratchOrgAlias} --sobject Account --check-defaults --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      assert.isDefined(result.sobjects['Account']);
      result.sobjects['Account'].analysedFields.forEach((fieldUsageStat) => {
        assert.isDefined(fieldUsageStat.defaultValue);
      });
    });

    it('successfully analyses valid sobject with check-history flag', () => {
      // Act
      const result = execCmd<JscMaintainFieldUsageAnalyseResult>(
        `jsc:maintain:field-usage:analyse --target-org ${scratchOrgAlias} --sobject Account --check-history --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      assert.isDefined(result.sobjects['Account']);
      result.sobjects['Account'].analysedFields.forEach((fieldUsageStat) => {
        assert.isDefined(fieldUsageStat.histories);
        assert.isDefined(fieldUsageStat.lastUpdated);
      });
    });
  });

  describe('export obsolete flows', () => {
    it('does not find obsolete flow versions on brand new scratch org', () => {
      // Act
      const result = execCmd<JscMaintainExportObsoleteFlowsResult>(
        `jsc:maintain:flow-export:obsolete --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(result.obsoleteVersions.length).to.equal(0);
    });

    it('creates package.xml and destructiveChanges.xml with output format and output dir', () => {
      // Act
      execCmd<JscMaintainExportObsoleteFlowsResult>(
        `jsc:maintain:flow-export:obsolete --target-org ${scratchOrgAlias} --output-format DestructiveChangesXML --output-dir ${sessionOutputPath} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      const expectedPackagePath = path.join(sessionOutputPath, 'package.xml');
      const expectedDestructivePath = path.join(sessionOutputPath, 'destructiveChanges.xml');
      expect(fs.existsSync(expectedPackagePath)).to.equal(true, 'package created');
      expect(fs.existsSync(expectedDestructivePath)).to.equal(true, 'destructiveChanges created');
    });
  });

  describe('export unused flows', () => {
    it('does not find unused flow versions on brand new scatch org', () => {
      // Act
      const result = execCmd<JscMaintainExportUnusedFlowsResult>(
        `jsc:maintain:flow-export:unused --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(result.unusedVersions.length).to.equal(0);
    });

    it('exports unused flow after deployment from test src', () => {
      // Arrange
      execCmd(`project:deploy:start --ignore-conflicts --target-org ${scratchOrgAlias} -d src/flows --json`, {
        ensureExitCode: 0,
        cli: 'sf',
      });

      // Act
      const result = execCmd<JscMaintainExportUnusedFlowsResult>(
        `jsc:maintain:flow-export:unused --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(result.unusedVersions.length).to.equal(1);
      expect(result.unusedVersions[0].DeveloperName).to.equal('Inactive_Test_Flow');
      expect(result.unusedVersions[0].VersionNumber).to.equal(1);
    });

    it('creates package.xml and destructiveChanges.xml with output format and output dir', () => {
      // Act
      execCmd<JscMaintainExportObsoleteFlowsResult>(
        `jsc:maintain:flow-export:unused --target-org ${scratchOrgAlias} --output-format DestructiveChangesXML --output-dir ${sessionOutputPath} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      const expectedPackagePath = path.join(sessionOutputPath, 'package.xml');
      const expectedDestructivePath = path.join(sessionOutputPath, 'destructiveChanges.xml');
      expect(fs.existsSync(expectedPackagePath)).to.equal(true, 'package created');
      expect(fs.existsSync(expectedDestructivePath)).to.equal(true, 'destructiveChanges created');
    });
  });
});
