/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
import fs from 'node:fs';
import { expect } from 'chai';
import { ZodError } from 'zod';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { SfError } from '@salesforce/core';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';
import { ZPackageInstallResultType } from '../../src/types/releaseManifest.js';
import ArtifactDeployJob from '../../src/release-manifest/artifact-deploy-strategies/artifactDeployJob.js';

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
      expect(jobs[0].getType()).to.equal('Unpackaged');
      expect(jobs[1].name).to.equal('apex_utils');
      expect(jobs[1].getType()).to.equal('UnlockedPackage');
      expect(jobs[2].name).to.equal('lwc_utils');
      expect(jobs[2].getType()).to.equal('UnlockedPackage');
    });
  });

  describe('deploy jobs', () => {
    it('package deploy job > resolves ids with devhub connection', async () => {
      // Arrange
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
        const _request = ensureJsonMap(request);
        if (request && ensureString(_request.url).includes("Package2Id%20%3D%20'0Ho0X0000000001AAA'")) {
          return Promise.resolve({ records: [{ SubscriberPackageVersionId: '04t0X0000000000AAA' }] });
        } else {
          return Promise.reject(new SfError(`Unexpected request: ${_request.url}`));
        }
      };

      // Act
      const packageJob = new ArtifactDeployJob('test_package', {
        type: 'UnlockedPackage',
        package_id: '0Ho0X0000000001AAA',
        version: '1.2.3',
      });
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.deployStrategy).to.equal('PackageInstall');
      expect(installStep.status).to.equal('Pending');
      expect(installStep.version).to.equal('1.2.3');
      expect(installStep.versionId).to.equal('04t0X0000000000AAA');
      expect(installStep.installedVersionId).to.equal(undefined);
    });
  });
});
