/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
import fs from 'node:fs';
import { expect } from 'chai';
import { ZodError } from 'zod';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
// import { SfError } from '@salesforce/core';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';
import { ZPackageInstallResultType } from '../../src/types/orgManifestOutputSchema.js';
import ArtifactDeployJob from '../../src/release-manifest/artifact-deploy-strategies/artifactDeployJob.js';
import { SfError } from '@salesforce/core';

// exhaustive list of all "valid" source paths that are used in test manifests
const testSourcePaths = [
  'test/data/mock-src/package-overrides/core-crm/dev',
  'test/data/mock-src/package-overrides/core-crm/prod',
  'test/data/mock-src/package-overrides/pims',
  'test/data/mock-src/package-extensions/core-crm',
  'test/data/mock-src/unpackaged/org-shape',
  'test/data/mock-src/unpackaged/qa',
  'test/data/mock-src/unpackaged/prod-only',
  'test/data/mock-src/unpackaged/my-happy-soup',
];

describe('org manifest', () => {
  const $$ = new TestContext();
  const mockDevHubOrg = new MockTestOrgData();
  const mockTargetOrg = new MockTestOrgData();

  beforeEach(async () => {
    mockDevHubOrg.username = 'devhub-admin@example.com';
    mockTargetOrg.username = 'admin@example.com.qa';
    mockDevHubOrg.isDevHub = true;
    await $$.stubAuths(mockDevHubOrg, mockTargetOrg);

    testSourcePaths.forEach((path) => {
      fs.mkdirSync(path, { recursive: true });
    });
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    fs.rmSync('test/data/mock-src', { recursive: true });
  });

  describe('loading', () => {
    it('parse complex manifest > loads successfully', () => {
      // Arrange
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');

      // Assert
      expect(orgManifest.data.environments).to.deep.equal({
        dev: 'admin-salesforce@mobilityhouse.com.dev',
        qa: 'admin@example.com.qa',
        prod: 'admin@example.com',
      });
      expect(orgManifest.getEnvironmentName('admin@example.com.qa')).to.equal('qa');
      expect(orgManifest.getEnvironmentName('admin-salesforce@mobilityhouse.com.dev')).to.equal('dev');
      expect(orgManifest.getEnvironmentName('unknown@example.com')).to.be.undefined;
      expect(orgManifest.getEnvironmentName('')).to.be.undefined;
      const artifactsMap = new Map(Object.entries(orgManifest.data.artifacts));
      expect(Array.from(artifactsMap.keys())).to.deep.equal([
        'org_shape_settings',
        'apex_utils',
        'lwc_utils',
        'core_crm',
        'core_crm_overrides',
        'core_crm_extensions',
        'pims',
        'pims_overrides',
      ]);
    });

    it('parse minimal manifest > loads successfully', () => {
      // Arrange
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/minimal.yaml');

      // Assert
      expect(orgManifest.data.environments).is.undefined;
      expect(orgManifest.getEnvironmentName('admin@example.com.qa')).to.be.undefined;
      const artifactsMap = new Map(Object.entries(orgManifest.data.artifacts));
      expect(Array.from(artifactsMap.keys())).to.deep.equal(['basic_happy_soup']);
    });

    it('loads manifest with simple path-directory does not exist > throws error', () => {
      // Arrange
      fs.rmdirSync('test/data/mock-src/unpackaged/my-happy-soup');

      // Assert
      expect(() => ReleaseManifestLoader.load('test/data/manifests/minimal.yaml')).to.throw(
        'Error parsing artifact "basic_happy_soup": test/data/mock-src/unpackaged/my-happy-soup does not exist.'
      );
    });

    it('loads manifest with complex path-directory does not exist > throws error', () => {
      // Arrange
      fs.rmdirSync('test/data/mock-src/package-overrides/pims');

      // Assert
      expect(() => ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml')).to.throw(
        'Error parsing artifact "pims_overrides": test/data/mock-src/package-overrides/pims does not exist.'
      );
    });

    it('loads manifest with missing environments > throws exception', () => {
      expect(() => ReleaseManifestLoader.load('test/data/manifests/invalid-path-no-envs.yaml')).to.throw(
        'Error parsing artifact "basic_happy_soup": "staging" is not defined in environments.'
      );
    });

    it('loads invalid manifest with missing required props > throws error', () => {
      // Act
      try {
        ReleaseManifestLoader.load('test/data/manifests/invalid.yaml');
        expect.fail('Should throw error, but succeeded');
      } catch (ze) {
        if (ze instanceof ZodError) {
          expect(ze.issues.length).to.equal(2, `${ze.toString()}`);
          expect(ze.issues[0].code).to.equal('invalid_type');
          expect(ze.issues[0].message).to.equal('At least one artifact is required');
          expect(ze.issues[1].code).to.equal('unrecognized_keys');
          expect(ze.issues[1].message).to.contain('not_artifacts_key');
        } else {
          expect.fail('Expected zod parsing error');
        }
      }
    });

    it('has invalid path file does not exist > throws error', () => {
      // Act
      expect(() => ReleaseManifestLoader.load('test/data/manifests/does-not-exist.yaml')).to.throw(
        'Invalid path, file does not exist: test/data/manifests/does-not-exist.yaml'
      );
    });
  });

  describe('manifest functionality', () => {
    it('loads full manifest > all artifacts loaded as deploy jobs', () => {
      // Act
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');
      const jobs = orgManifest.getDeployJobs();

      // Assert
      expect(jobs.length).to.equal(8);
      jobs.forEach((job) => {
        expect(job.getSteps().length).to.equal(1);
      });
      expect(jobs[0].name).to.equal('org_shape_settings');
      expect(jobs[0].definition.type).to.equal('Unpackaged');
      expect(jobs[1].name).to.equal('apex_utils');
      expect(jobs[1].definition.type).to.equal('UnlockedPackage');
      expect(jobs[2].name).to.equal('lwc_utils');
      expect(jobs[2].definition.type).to.equal('UnlockedPackage');
      expect(jobs[3].name).to.equal('core_crm');
      expect(jobs[3].definition.type).to.equal('UnlockedPackage');
      expect(jobs[4].name).to.equal('core_crm_overrides');
      expect(jobs[4].definition.type).to.equal('Unpackaged');
      const apexUtilsStep = jobs[1].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(apexUtilsStep.shouldSkipIfInstalled).to.equal(false);
      const lwcUtilsStep = jobs[2].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(lwcUtilsStep.shouldSkipIfInstalled).to.equal(true);
      const coreCrmSteps = jobs[3].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(coreCrmSteps.shouldSkipIfInstalled).to.equal(true);
    });

    it('loads manifest with non-default package options > deploy jobs configured correctly', () => {
      // Act
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-non-defaults.yaml');
      const jobs = orgManifest.getDeployJobs();

      // Assert
      expect(jobs.length).to.equal(2);
      expect(jobs[0].name).to.equal('apex_utils');
      expect(jobs[0].definition.type).to.equal('UnlockedPackage');
      const apexUtilsStep = jobs[0].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(apexUtilsStep.shouldSkipIfInstalled).to.equal(true);
      const lwcUtilsStep = jobs[1].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(lwcUtilsStep.shouldSkipIfInstalled).to.equal(false);
    });
  });

  describe('deploy jobs', () => {
    it('resolves package deploy job > loads version ids with devhub and target org connection', async () => {
      // Arrange
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      mockPackageInstallRequestQueries('0Ho0X0000000001AAA');

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X0000000001AAA',
          version: '1.2.3',
          skip_if_installed: false,
        },
        { skip_if_installed: true, requires_promoted_versions: true, strict_environments: false, pipefail: true }
      );
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.deployStrategy).to.equal('PackageInstall');
      expect(installStep.status).to.equal('Pending');
      expect(installStep.version).to.equal('1.2.3');
      expect(installStep.versionId).to.equal('04t0X0000000001AAA');
      expect(installStep.installedVersionId).to.equal('04t0X0000000000AAA');
      expect(installStep.installedVersion).to.equal('1.2.2');
    });

    it('resolves package deploy job > invalid package version > throws error', async () => {
      // Arrange
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      // different id than the one in package job
      mockPackageInstallRequestQueries('0Ho0X0000000000AAA');

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X000000000XAAA',
          version: '2.0.0',
          skip_if_installed: false,
        },
        { skip_if_installed: true, requires_promoted_versions: true, strict_environments: false, pipefail: true }
      );

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.message).to.equal(
            'No released package version found for package id 0Ho0X000000000XAAA and version 2.0.0'
          );
        }
      }
    });
  });

  function mockPackageInstallRequestQueries(packageId: string) {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const _request = ensureJsonMap(request);
      if (
        request &&
        ensureString(_request.url).includes(`Package2Id%20%3D%20'${packageId}'`) &&
        ensureString(_request.url).includes(mockDevHubOrg.instanceUrl)
      ) {
        return Promise.resolve({ records: [{ SubscriberPackageVersionId: '04t0X0000000001AAA' }] });
      } else if (
        request &&
        ensureString(_request.url).includes(`SubscriberPackageId%20%3D%20'${packageId}'`) &&
        ensureString(_request.url).includes(mockTargetOrg.instanceUrl)
      ) {
        return Promise.resolve({
          records: [
            {
              SubscriberPackageVersionId: '04t0X0000000000AAA',
              SubscriberPackageVersion: { MajorVersion: '1', MinorVersion: '2', PatchVersion: '2' },
            },
          ],
        });
      } else {
        return Promise.resolve({ records: [] });
      }
    };
  }
});
