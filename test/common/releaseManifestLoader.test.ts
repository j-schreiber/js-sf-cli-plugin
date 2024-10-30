/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
import fs from 'node:fs';
import { expect } from 'chai';
import { ZodError } from 'zod';
import { SfError } from '@salesforce/core';
import { QueryResult } from '@jsforce/jsforce-node';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';
import { ZPackageInstallResultType } from '../../src/types/orgManifestOutputSchema.js';
import ArtifactDeployJob from '../../src/release-manifest/artifact-deploy-strategies/artifactDeployJob.js';
import { InstalledSubscriberPackage, Package2Version } from '../../src/types/sfToolingApiTypes.js';
import {
  initSourceDirectories,
  MockInstalledVersionQueryResult,
  MockPackageVersionQueryResult,
} from '../mock-utils/releaseManifestMockUtils.js';

const DEFAULT_MANIFEST_OPTIONS = {
  skip_if_installed: true,
  requires_promoted_versions: true,
  strict_environments: false,
  pipefail: true,
};

describe('org manifest', () => {
  const $$ = new TestContext();
  const mockDevHubOrg = new MockTestOrgData();
  const mockTargetOrg = new MockTestOrgData();

  beforeEach(async () => {
    mockDevHubOrg.username = 'devhub-admin@example.com';
    mockTargetOrg.username = 'admin@example.com.qa';
    mockDevHubOrg.isDevHub = true;
    await $$.stubAuths(mockDevHubOrg, mockTargetOrg);
    initSourceDirectories();
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
    let DEFAULT_INSTALLED_PACKAGE_RESULT: Partial<QueryResult<InstalledSubscriberPackage>>;
    let DEFAULT_PACKAGE_VERSION: Partial<QueryResult<Package2Version>>;

    beforeEach(() => {
      DEFAULT_INSTALLED_PACKAGE_RESULT = MockInstalledVersionQueryResult;
      DEFAULT_PACKAGE_VERSION = MockPackageVersionQueryResult;
    });

    it('resolves package deploy job > loads version ids with devhub and target org connection', async () => {
      // Arrange
      mockPackageInstallRequestQueries('0Ho0X0000000001AAA', '033000000000000AAA');

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X0000000001AAA',
          version: '1.2.3',
          skip_if_installed: false,
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
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
      expect(installStep.useInstallationKey).to.equal(false);
      expect(installStep.shouldSkipIfInstalled).to.equal(false);
      expect(installStep.skipped).to.equal(false);
    });

    it('resolves package deploy job > no installed version > loads version from devhub and prepares install', async () => {
      // Arrange
      // only return a subscriber version id for the devhub query
      $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
        if (isPackageVersionDevhubQuery(request, '0Ho0X0000000001AAA')) {
          return Promise.resolve(DEFAULT_PACKAGE_VERSION);
        } else {
          return Promise.resolve({ records: [] });
        }
      };

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X0000000001AAA',
          version: '1.2.3',
          skip_if_installed: true,
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.status).to.equal('Pending');
      expect(installStep.versionId).to.equal('04t0X0000000001AAA');
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.skipped).to.equal(false);
      expect(installStep.installedVersionId).to.equal(undefined);
      expect(installStep.installedVersion).to.equal(undefined);
    });

    it('resolves package deploy job that explicitly sets true > same version already installed > prepares to skip', async () => {
      // Arrange
      // only return a subscriber version id for the devhub query
      const packageId = '0Ho0X0000000001AAA';
      const subscriberId = '033000000000000AAA';
      const defaultPackageVersionId = DEFAULT_INSTALLED_PACKAGE_RESULT.records![0].SubscriberPackageVersionId;
      mockSameInstalledPackageVersions(packageId, subscriberId, defaultPackageVersionId);

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: packageId,
          version: '1.2.2',
          skip_if_installed: true,
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.status).to.equal('Pending');
      expect(installStep.versionId).to.equal(defaultPackageVersionId);
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.skipped).to.equal(true);
      expect(installStep.installedVersionId).to.equal(defaultPackageVersionId);
    });

    it('resolves package deploy job that implicitly skips from default options > same version already installed > prepares to skip', async () => {
      // Arrange
      // only return a subscriber version id for the devhub query
      const packageId = '0Ho0X0000000001AAA';
      const subscriberId = '033000000000000AAA';
      const defaultPackageVersionId = DEFAULT_INSTALLED_PACKAGE_RESULT.records![0].SubscriberPackageVersionId;
      mockSameInstalledPackageVersions(packageId, subscriberId, defaultPackageVersionId);

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: packageId,
          version: '1.2.2',
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.skipped).to.equal(true);
    });

    it('resolves package deploy job > package has no released version > throws error', async () => {
      // Arrange
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      // different id than the one in package job
      mockPackageInstallRequestQueries('0Ho0X0000000000AAA', '033000000000000AAA');

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X000000000XAAA',
          version: '2.0.0',
          skip_if_installed: false,
        },
        DEFAULT_MANIFEST_OPTIONS
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

    it('resolves package deploy job > requires installation key but none configured > throws error', async () => {
      // Arrange
      const packageId = '0Ho0X0000000001AAA';
      mockPackageVersionWithInstallationKey(packageId);

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: packageId,
          version: '2.0.0',
          skip_if_installed: false,
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.message).to.contain('2.0.0 (04t0X0000000001AAA)');
          expect(err.message).to.contain('requires an installation key');
        }
      }
    });

    it('resolves package deploy job > requires installation key but env is not set > throws error', async () => {
      // Arrange
      const packageId = '0Ho0X0000000001AAA';
      mockPackageVersionWithInstallationKey(packageId);

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: packageId,
          version: '2.0.0',
          skip_if_installed: false,
          installation_key: 'MY_INSTALLATION_KEY',
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.message).to.contain('MY_INSTALLATION_KEY');
        }
      }
    });

    it('resolves package deploy job > requires installation that is set', async () => {
      // Arrange
      const packageId = '0Ho0X0000000001AAA';
      mockPackageVersionWithInstallationKey(packageId);
      process.env.MY_INSTALLATION_KEY = '123testkey';

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: packageId,
          version: '2.0.0',
          skip_if_installed: false,
          installation_key: 'MY_INSTALLATION_KEY',
        },
        DEFAULT_MANIFEST_OPTIONS
      );
      const devhubConnection = await mockDevHubOrg.getConnection();
      const targetConnection = await mockTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.deployStrategy).to.equal('PackageInstall');
      expect(installStep.useInstallationKey).to.equal(true);
      expect(installStep.installationKey).to.equal('123testkey');
    });

    function mockSameInstalledPackageVersions(packageId: string, subscriberId: string, versionId: string) {
      $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
        if (isPackageVersionDevhubQuery(request, packageId)) {
          const returnValue = structuredClone(DEFAULT_PACKAGE_VERSION);
          returnValue.records![0].SubscriberPackageVersionId = versionId;
          return Promise.resolve(returnValue);
        } else if (isTargetOrgInstalledVersionQuery(request, subscriberId)) {
          return Promise.resolve(DEFAULT_INSTALLED_PACKAGE_RESULT);
        } else {
          return Promise.resolve({ records: [] });
        }
      };
    }

    function mockPackageInstallRequestQueries(packageId: string, subscriberId: string) {
      $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
        if (isPackageVersionDevhubQuery(request, packageId)) {
          return Promise.resolve(DEFAULT_PACKAGE_VERSION);
        } else if (isTargetOrgInstalledVersionQuery(request, subscriberId)) {
          return Promise.resolve(DEFAULT_INSTALLED_PACKAGE_RESULT);
        } else {
          return Promise.resolve({ records: [] });
        }
      };
    }

    function mockPackageVersionWithInstallationKey(packageId: string) {
      $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
        if (isPackageVersionDevhubQuery(request, packageId)) {
          const returnValue = { ...DEFAULT_PACKAGE_VERSION };
          returnValue.records![0].SubscriberPackageVersion.IsPasswordProtected = true;
          return Promise.resolve(returnValue);
        } else {
          return Promise.resolve({ records: [] });
        }
      };
    }

    function isPackageVersionDevhubQuery(request: AnyJson, packageId: string): boolean {
      const _request = ensureJsonMap(request);
      return Boolean(
        request &&
          ensureString(_request.url).includes(`Package2Id%20%3D%20'${packageId}'`) &&
          ensureString(_request.url).includes(mockDevHubOrg.instanceUrl)
      );
    }

    function isTargetOrgInstalledVersionQuery(request: AnyJson, packageId: string): boolean {
      const _request = ensureJsonMap(request);
      return Boolean(
        request &&
          ensureString(_request.url).includes(`SubscriberPackageId%20%3D%20'${packageId}'`) &&
          ensureString(_request.url).includes(mockTargetOrg.instanceUrl)
      );
    }
  });
});
