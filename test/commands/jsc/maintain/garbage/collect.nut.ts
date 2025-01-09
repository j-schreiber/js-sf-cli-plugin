import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { XMLParser } from 'fast-xml-parser';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { PackageGarbageResult } from '../../../../../src/garbage-collection/packageGarbageTypes.js';
import { PackageManifestObject } from '../../../../../src/garbage-collection/packageManifestTypes.js';

const scratchOrgAlias = 'TestTargetOrg';
const projectName = 'test-sfdx-project';
const outputDir = path.join('tmp', 'garbage');

describe('jsc maintain garbage NUTs*', () => {
  let session: TestSession;
  let sessionOutputPath: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'garbageCollectionProject',
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
  });

  after(async () => {
    await session?.clean();
  });

  afterEach(() => {
    fs.rmSync(sessionOutputPath, { recursive: true, force: true });
  });

  describe('garbage collection', () => {
    it('collect garbage on fresh scratch org with json output', () => {
      // Act
      const result = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      // a new org is never supposed to have any package garbage
      expect(result).to.not.be.undefined;
      expect(result?.totalDeprecatedComponentCount).to.equal(0);
      expect(result?.deprecatedMembers).to.deep.equal({});
    });

    it('collect garbage on fresh scratch org with package xml output', () => {
      // Act
      execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --output-format PackageXML --output-dir ${outputDir}`,
        { ensureExitCode: 0 }
      );

      // Assert
      const expectedPackagePath = path.join(sessionOutputPath, 'package.xml');
      const expectedDestructivePath = path.join(sessionOutputPath, 'destructiveChanges.xml');
      expect(fs.existsSync(expectedPackagePath)).to.equal(true, 'package created');
      expect(fs.existsSync(expectedDestructivePath)).to.equal(false, 'no destructiveChanges created');
      const packageXml = new XMLParser().parse(fs.readFileSync(expectedPackagePath), true) as PackageManifestObject;
      expect(packageXml.Package.types).to.equal(undefined, 'package xml is empty');
    });
  });
});
