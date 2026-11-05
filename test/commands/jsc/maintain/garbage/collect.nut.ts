import fs from 'node:fs';
import path from 'node:path';
import { expect, assert } from 'chai';
import { XMLParser } from 'fast-xml-parser';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import {
  PackageGarbageContainer,
  PackageGarbageResult,
} from '../../../../../src/garbage-collection/packageGarbageTypes.js';
import { GarbageDisposeResult } from '../../../../../src/types/garbageDisposeTypes.js';
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
      assert.isDefined(result);
      expect(result.totalDeprecatedComponentCount).to.equal(0);
      expect(result.deprecatedMembers).to.deep.equal({});
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
      // The package alias from command parameter are resolved in the test project's sfdx-project.json
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
      assert.isDefined(result);
      const deprecatedMembers = result.deprecatedMembers;
      // Update the JSON file from EXPECTED_E2E_GARBAGE for new assert
      // most important part of this test is running the individual handlers against
      // an actual org and executing real queries.
      const actualDeprecatedEntities = Object.keys(deprecatedMembers);
      const expectedDeprecatedEntities = EXPECTED_E2E_GARBAGE.deprecatedMembers;
      // we care for equal values, but not for their order
      expect(actualDeprecatedEntities).to.have.deep.members(Object.keys(EXPECTED_E2E_GARBAGE.deprecatedMembers));
      for (const depEnt of actualDeprecatedEntities) {
        expect(deprecatedMembers[depEnt].componentCount).to.equal(expectedDeprecatedEntities[depEnt].componentCount);
        expect(deprecatedMembers[depEnt].metadataType).to.equal(expectedDeprecatedEntities[depEnt].metadataType);
        // all components are expected to be deprecated since LATEST
        // probably need to revisit that, and dynamically resolve LATEST to actual version
        deprecatedMembers[depEnt].components.forEach((cmp) => {
          expect(cmp.deprecatedSinceVersion).to.equal('1.0.0', JSON.stringify(cmp));
        });
        // remove the "subjectId" from actual deprecated members, so we can compare only
        // the immutable properties with expected result from EXPECTED_E2E_GARBAGE.
        // eslint-disable-next-line arrow-body-style
        const reducedMembers = deprecatedMembers[depEnt].components.map(({ fullyQualifiedName, developerName }) => {
          return { fullyQualifiedName, developerName };
        });
        expect(reducedMembers).to.have.deep.members(expectedDeprecatedEntities[depEnt].components);
      }
    });

    it('filters garbage output with metadata type filter', () => {
      // Arrange
      // not specifically needed, was done in test before

      // Act
      const result = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --metadata-type CustomField --metadata-type ExternalString --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(Object.keys(result.deprecatedMembers)).to.has.members(['CustomField', 'ExternalString']);
      expect(result.deprecatedMembers.CustomField.components.length).to.equal(
        EXPECTED_E2E_GARBAGE.deprecatedMembers.CustomField.componentCount
      );
      expect(result.deprecatedMembers.ExternalString.components.length).to.equal(
        EXPECTED_E2E_GARBAGE.deprecatedMembers.ExternalString.componentCount
      );
    });

    it('dispose garbage with metadata type filter deletes only filtered garbage', () => {
      // Act
      const result = execCmd<GarbageDisposeResult>(
        `jsc:maintain:garbage:dispose --target-org ${scratchOrgAlias} --metadata-type ExternalString --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(result.status).to.equal('Success', JSON.stringify(result.failed));
      expect(Object.keys(result.deprecatedMembers)).to.deep.equal(['ExternalString']);
      expect(Object.keys(result.disposed)).to.deep.equal(['ExternalString']);
      expect(result.totalDeprecatedComponentCount).to.equal(
        EXPECTED_E2E_GARBAGE.deprecatedMembers.ExternalString.componentCount
      );
      const remaining = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert.isDefined(remaining);
      expect(remaining.deprecatedMembers.ExternalString).to.be.undefined;
      expect(remaining.deprecatedMembers.CustomField.componentCount).to.equal(
        EXPECTED_E2E_GARBAGE.deprecatedMembers.CustomField.componentCount
      );
    });

    it('dispose all remaining garbage deletes everything that can be deleted', () => {
      // Act
      const result = execCmd<GarbageDisposeResult>(
        `jsc:maintain:garbage:dispose --target-org ${scratchOrgAlias} --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      // the test package contains components that cannot be deleted (e.g. an active
      // approval process), but which ones depends on the package contents and on
      // cascading deletes in the org. Only assert invariants of the result.
      assert.isDefined(result);
      expect(result.status).to.be.oneOf(['Success', 'PartialSuccess'], JSON.stringify(result.failed));
      expect(result.deployId).to.be.a('string');
      assertDisposeResultIsConsistent(result);
      const remaining = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert.isDefined(remaining);
      // garbage that was disposed is gone, only garbage that failed can be left. Compare by
      // id, because names can change (children of deleted objects are named with the object id)
      expect(result.failed.map((f) => f.subjectId)).to.include.members(
        garbageIds(remaining.deprecatedMembers),
        JSON.stringify({ failed: result.failed, remaining: remaining.deprecatedMembers })
      );
    });

    it('dispose again only processes leftover garbage', () => {
      // Arrange
      const leftovers = execCmd<PackageGarbageResult>(
        `jsc:maintain:garbage:collect --target-org ${scratchOrgAlias} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      assert.isDefined(leftovers);

      // Act
      const cmd = execCmd<GarbageDisposeResult>(
        `jsc:maintain:garbage:dispose --target-org ${scratchOrgAlias} --no-prompt --json`
      );
      const result = cmd.jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(garbageIds(result.deprecatedMembers)).to.have.members(garbageIds(leftovers.deprecatedMembers));
      assertDisposeResultIsConsistent(result);
      expect(cmd.jsonOutput?.status).to.equal(result.status === 'Failed' ? 1 : 0);
    });

    it('dispose without garbage skips deploy', () => {
      // Act
      const result = execCmd<GarbageDisposeResult>(
        `jsc:maintain:garbage:dispose --target-org ${scratchOrgAlias} --metadata-type ExternalString --no-prompt --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      // Assert
      assert.isDefined(result);
      expect(result.status).to.equal('Skipped');
      expect(result.deployId).to.be.undefined;
    });
  });
});

function garbageIds(containers: { [x: string]: PackageGarbageContainer }): string[] {
  return Object.values(containers).flatMap((container) => container.components.map((cmp) => cmp.subjectId));
}

/**
 * Every garbage component that was found is either disposed or failed, never both
 * (compared by id, names are not stable). Failures always have a problem. The status
 * matches disposed and failed garbage.
 */
function assertDisposeResultIsConsistent(result: GarbageDisposeResult): void {
  const disposed = garbageIds(result.disposed);
  const failed = result.failed.map((f) => f.subjectId);
  expect([...disposed, ...failed]).to.have.members(garbageIds(result.deprecatedMembers), JSON.stringify(result));
  result.failed.forEach((failure) => expect(failure.problem).to.be.a('string').and.not.be.empty);
  switch (result.status) {
    case 'Success':
      expect(failed).to.deep.equal([]);
      break;
    case 'PartialSuccess':
      expect(disposed).to.not.be.empty;
      expect(failed).to.not.be.empty;
      break;
    case 'Failed':
      expect(disposed).to.deep.equal([]);
      break;
    default:
      expect(result.status).to.equal('Skipped');
  }
}
