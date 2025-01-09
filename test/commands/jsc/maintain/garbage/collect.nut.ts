import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { XMLParser } from 'fast-xml-parser';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { PackageGarbageResult } from '../../../../../src/garbage-collection/packageGarbageTypes.js';
import { PackageManifestObject } from '../../../../../src/garbage-collection/packageManifestTypes.js';
import { EXPECTED_E2E_GARBAGE } from '../../../../mock-utils/garbageCollectionMocks.js';

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

  /**
   * To save limits and re-use the same scratch org, these tests actually
   * must execute in sequence. The last test deprecates some components
   * which will result in garbage finds.
   */
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

    it('collect garbage with deprecated components on scratch org', () => {
      // Arrange
      // Package versions are build here: https://github.com/j-schreiber/js-cli-plugin-test-package
      // Installs the latest package version (with a lot of metadata) and rolls back to 0.1.0 (almost empty)
      // Actual package versions are resolved in the test project's sfdx-project.json
      execCmd(`package:install -p "Test Package @ LATEST" -o ${scratchOrgAlias} -w 10 --json`, {
        ensureExitCode: 0,
        cli: 'sf',
      });
      execCmd(
        `package:install -p "Test Package @ 0.1.0" -o ${scratchOrgAlias} -w 10 --json --upgrade-type DeprecateOnly`,
        {
          ensureExitCode: 0,
          cli: 'sf',
        }
      );

      // Act
      const result = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      expect(result).to.not.be.undefined;
      const deprecatedMembers = result!.deprecatedMembers;
      // the E2E expect file is updated, as the package versions receive more metadata
      // don't assert equality too deep - we mostly care that every single query / handler
      // is executed and validated. Actual logic to parse query results is unit tested
      const actualDeprecatedEntities = Object.keys(deprecatedMembers);
      const expectedDeprecatedEntities = EXPECTED_E2E_GARBAGE.deprecatedMembers;
      expect(actualDeprecatedEntities).to.deep.equal(Object.keys(EXPECTED_E2E_GARBAGE.deprecatedMembers));
      for (const depEnt of actualDeprecatedEntities) {
        expect(deprecatedMembers[depEnt].componentCount).to.equal(expectedDeprecatedEntities[depEnt].componentCount);
        expect(deprecatedMembers[depEnt].metadataType).to.equal(expectedDeprecatedEntities[depEnt].metadataType);
      }
    });
  });
});
