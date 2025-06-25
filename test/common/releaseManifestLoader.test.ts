/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
import fs from 'node:fs';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';
import { ZPackageInstallResultType, ZSourceDeployResultType } from '../../src/types/orgManifestOutputSchema.js';
import ArtifactDeployJob from '../../src/release-manifest/artifact-deploy-strategies/artifactDeployJob.js';
import {
  ZArtifactType,
  ZReleaseManifestType,
  ZUnlockedPackageArtifact,
  ZUnpackagedSourceArtifact,
} from '../../src/types/orgManifestInputSchema.js';
import OrgManifest from '../../src/release-manifest/OrgManifest.js';
import { DeployStatus } from '../../src/types/orgManifestGlobalConstants.js';
import { ProcessingStatus } from '../../src/common/comms/processingEvents.js';
import { ScheduledJobConfigType } from '../../src/types/scheduledApexTypes.js';
import ManifestTestContext from '../mock-utils/manifestTestContext.js';

const DEFAULT_MANIFEST_OPTIONS = {
  skip_if_installed: true,
  requires_promoted_versions: true,
  strict_environments: false,
  pipefail: true,
};

const TEST_ENVS = {
  dev: 'admin@example.com.dev',
  stage: 'admin@example.com.stage',
  'pre-prod': 'admin@example.com.qa',
  prod: 'devhub-admin@example.com',
};

const TEST_MANIFEST = new OrgManifest({
  options: DEFAULT_MANIFEST_OPTIONS,
  environments: TEST_ENVS,
  artifacts: {},
} as ZReleaseManifestType);

describe('org manifest', () => {
  describe('loading', () => {
    const $$ = new ManifestTestContext();

    beforeEach(async () => {
      await $$.init();
    });

    afterEach(async () => {
      $$.restore();
    });

    it('parse complex manifest > loads successfully', () => {
      // Arrange
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');

      // Assert
      expect(orgManifest.data.environments).to.deep.equal({
        dev: 'admin-salesforce@mobilityhouse.com.dev',
        qa: 'admin@example.com.qa',
        prod: 'admin@example.com',
      });
      expect(orgManifest.requiresProject()).to.be.true;
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
      expect(orgManifest.requiresProject()).to.be.true;
      expect(orgManifest.data.environments).is.undefined;
      expect(orgManifest.getEnvironmentName('admin@example.com.qa')).to.be.undefined;
      const artifactsMap = new Map(Object.entries(orgManifest.data.artifacts));
      expect(Array.from(artifactsMap.keys())).to.deep.equal(['basic_happy_soup']);
    });

    it('loads manifest with valid cron jobs artifact', () => {
      // Act
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/cron-job-manifest.yaml');

      // Assert
      expect(Object.keys(orgManifest.data.artifacts)).to.deep.equal(['scheduled_jobs']);
      const jobsConfig = orgManifest.data.artifacts.scheduled_jobs as ScheduledJobConfigType;
      expect(jobsConfig.options).to.deep.equal({ stop_other_jobs: false });
      expect(jobsConfig.jobs).to.deep.equal({
        'Test Job 1': { class: 'TestJob', expression: '0 0 0 1 * * *' },
        'Test Job 2': { class: 'TestSchedulable2', expression: '0 0 1 ? * * *' },
        'Test Job 3': { class: 'TestSchedulable2', expression: '0 0 2 ? * * *' },
      });
    });

    it('loads manifest with simple path-directory does not exist > throws error', () => {
      // Arrange
      fs.rmSync('test/data/mock-src/unpackaged/my-happy-soup', { recursive: true });

      // Assert
      expect(() => ReleaseManifestLoader.load('test/data/manifests/minimal.yaml')).to.throw(
        'Error parsing artifact "basic_happy_soup": test/data/mock-src/unpackaged/my-happy-soup does not exist.'
      );
    });

    it('loads manifest with complex path-directory does not exist > throws error', () => {
      // Arrange
      fs.rmSync('test/data/mock-src/package-overrides/pims', { recursive: true });

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
      const manifestLoaderFunct = () => ReleaseManifestLoader.load('test/data/manifests/invalid.yaml');
      expect(manifestLoaderFunct).to.throw('At least one artifact is required');
      expect(manifestLoaderFunct).to.throw('not_artifacts_key');
    });

    it('has invalid path file does not exist > throws error', () => {
      // Act
      expect(() => ReleaseManifestLoader.load('test/data/manifests/does-not-exist.yaml')).to.throw(
        'test/data/manifests/does-not-exist.yaml'
      );
    });

    it('defines existing empty path in unpackaged artifact > throws error', () => {
      // Arrange
      fs.rmSync('test/data/mock-src/unpackaged/my-happy-soup/classes', { recursive: true });

      // Act
      expect(() => ReleaseManifestLoader.load('test/data/manifests/minimal.yaml')).to.throw(
        'Artifact basic_happy_soup specified an empty path: test/data/mock-src/unpackaged/my-happy-soup'
      );
    });

    it('defines existing path in unpackaged artifact that contains directories > throws error', () => {
      // Arrange
      const testDir = 'test/data/mock-src/unpackaged/my-happy-soup/classes';
      // reset all files from test setup
      fs.readdirSync(testDir).forEach((f) => fs.rmSync(`${testDir}/${f}`));
      fs.mkdirSync('test/data/mock-src/unpackaged/my-happy-soup/objects/Account', { recursive: true });

      // Act
      expect(() => ReleaseManifestLoader.load('test/data/manifests/minimal.yaml')).to.throw(
        'Artifact basic_happy_soup specified an empty path: test/data/mock-src/unpackaged/my-happy-soup'
      );
    });
  });

  describe('manifest functionality', () => {
    const $$ = new ManifestTestContext();

    beforeEach(async () => {
      await $$.init();
    });

    afterEach(async () => {
      $$.restore();
    });

    it('loads full manifest > all artifacts loaded as deploy jobs', () => {
      // Act
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');
      const jobs = orgManifest.getDeployJobs();

      // Assert
      expect(orgManifest.requiresProject()).to.be.true;
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
      const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-global-options.yaml');
      const jobs = orgManifest.getDeployJobs();

      // Assert
      expect(orgManifest.requiresProject()).to.be.false;
      expect(jobs.length).to.equal(2);
      expect(jobs[0].name).to.equal('apex_utils');
      expect(jobs[0].definition.type).to.equal('UnlockedPackage');
      const apexUtilsStep = jobs[0].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(apexUtilsStep.shouldSkipIfInstalled).to.equal(true);
      const lwcUtilsStep = jobs[1].getSteps()[0].getStatus() as ZPackageInstallResultType;
      expect(lwcUtilsStep.shouldSkipIfInstalled).to.equal(false);
    });
  });

  describe('resolve package install jobs', () => {
    const $$ = new ManifestTestContext();
    const testPackageId = '0Ho0X0000000001AAA';
    const testNewVersionId = '04t0X0000000001AAA';

    const MockNoSkipInstallPackage: ZUnlockedPackageArtifact = {
      type: 'UnlockedPackage',
      package_id: testPackageId,
      version: '1.2.3',
      skip_if_installed: false,
    };

    const MockSkipInstallPackage: ZUnlockedPackageArtifact = {
      type: 'UnlockedPackage',
      package_id: testPackageId,
      version: '1.2.3',
      skip_if_installed: true,
    };

    beforeEach(async () => {
      await $$.init();
    });

    afterEach(async () => {
      $$.restore();
    });

    it('loads version ids with devhub and target org connection', async () => {
      // Act
      const packageJob = new ArtifactDeployJob('test_package', MockNoSkipInstallPackage, TEST_MANIFEST);
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.deployStrategy).to.equal('PackageInstall');
      expect(installStep.status).to.equal('Resolved');
      expect(installStep.requestedVersion).to.equal('1.2.3');
      expect(installStep.requestedVersionId).to.equal('04t0X0000000001AAA');
      expect(installStep.installedVersionId).to.equal('04t0X0000000001AAA');
      expect(installStep.installedVersion).to.equal('1.2.3');
      expect(installStep.useInstallationKey).to.equal(false);
      expect(installStep.shouldSkipIfInstalled).to.equal(false);
    });

    it('target org has no version installed > loads version from devhub and prepares install', async () => {
      // Arrange
      $$.installedPackageVersion = [];

      // Act
      const packageJob = new ArtifactDeployJob('test_package', MockSkipInstallPackage, TEST_MANIFEST);
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.status).to.equal('Resolved');
      expect(installStep.requestedVersionId).to.equal('04t0X0000000001AAA');
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.installedVersionId).to.equal(undefined);
      expect(installStep.installedVersion).to.equal(undefined);
    });

    it('explicitly sets skip if installed true > same version already installed > prepares to skip', async () => {
      // Arrange
      // default config of manifest has same resolved version as installed version

      // Act
      const packageJob = new ArtifactDeployJob('test_package', MockSkipInstallPackage, TEST_MANIFEST);
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.status).to.equal('Skipped');
      expect(installStep.requestedVersionId).to.equal('04t0X0000000001AAA');
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.installedVersionId).to.equal('04t0X0000000001AAA');
    });

    it('implicitly skips if installed from default options > same version already installed > prepares to skip', async () => {
      // Arrange
      // default config of manifest has same resolved version as installed version

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho000000000000AAA',
          version: '1.2.3',
        },
        TEST_MANIFEST
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.shouldSkipIfInstalled).to.equal(true);
      expect(installStep.status).to.equal('Skipped');
      expect(installStep.displayMessage).to.equal('Installed version matches requested version (1.2.3)');
    });

    it('package has no released version > throws error', async () => {
      // Arrange
      $$.resolvedPackageVersions = [];
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: '0Ho0X000000000XAAA',
          version: '2.0.0',
          skip_if_installed: false,
        },
        TEST_MANIFEST
      );

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.name).to.equal('NoReleasedPackageVersionFound');
          expect(err.message).to.equal(
            `No released version found for package id 0Ho0X000000000XAAA and version 2.0.0 on devhub ${$$.testDevHub.username}.`
          );
        }
      }
    });

    it('package requires installation key but none configured > throws error', async () => {
      // Arrange
      $$.resolvedPackageVersions[0].SubscriberPackageVersion.IsPasswordProtected = true;

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: $$.getPackageId(),
          version: '2.0.0',
          skip_if_installed: false,
        },
        TEST_MANIFEST
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.name).to.equal('InstallationKeyRequired');
          expect(err.message).to.contain('2.0.0 (04t0X0000000001AAA)');
          expect(err.message).to.contain('requires an installation key');
        }
      }
    });

    it('package requires installation key but env is not set > throws error', async () => {
      // Arrange
      $$.resolvedPackageVersions[0].SubscriberPackageVersion.IsPasswordProtected = true;

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: $$.getPackageId(),
          version: '2.0.0',
          skip_if_installed: false,
          installation_key: 'MY_INSTALLATION_KEY',
        },
        TEST_MANIFEST
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();

      // Assert
      try {
        await packageJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.name).to.equal('InstallationKeyEmpty');
          expect(err.message).to.contain('MY_INSTALLATION_KEY');
        }
      }
    });

    it('package requires installation that is set > resolves successfully', async () => {
      // Arrange
      $$.resolvedPackageVersions[0].SubscriberPackageVersion.IsPasswordProtected = true;
      process.env.MY_INSTALLATION_KEY = '123testkey';

      // Act
      const packageJob = new ArtifactDeployJob(
        'test_package',
        {
          type: 'UnlockedPackage',
          package_id: $$.getPackageId(),
          version: '2.0.0',
          skip_if_installed: false,
          installation_key: 'MY_INSTALLATION_KEY',
        },
        TEST_MANIFEST
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await packageJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const installStep = steps[0] as ZPackageInstallResultType;
      expect(installStep.status).to.equal('Resolved');
      expect(installStep.deployStrategy).to.equal('PackageInstall');
      expect(installStep.useInstallationKey).to.equal(true);
      expect(installStep.installationKey).to.equal('123testkey');
    });

    it('should install new version > status generates useful display message', async () => {
      // Act
      const packageJob = new ArtifactDeployJob('test_package', MockNoSkipInstallPackage, TEST_MANIFEST);
      const resolveResult = await packageJob.resolve(
        await $$.testTargetOrg.getConnection(),
        await $$.testDevHub.getConnection()
      );

      // Assert
      expect(resolveResult.length).to.equal(1, resolveResult.toString());
      const installStep = resolveResult[0] as ZPackageInstallResultType;
      expect(installStep.displayMessage).to.equal('Installing 1.2.3 over 1.2.3');
    });

    it('should install package version > delegates to sf package install', async () => {
      // Arrange
      $$.resolvedPackageVersions[0].SubscriberPackageVersionId = '04t0X0000000001AAA';
      $$.installedPackageVersion[0].SubscriberPackageVersion.PatchVersion = 2;
      const oclifWrapperStub = $$.getOclifWrapperStub();
      const statusListener = $$.$$.SANDBOX.stub();
      const packageJob = new ArtifactDeployJob('test_package', MockNoSkipInstallPackage, TEST_MANIFEST);
      packageJob.on('artifactDeployStart', statusListener);
      packageJob.on('artifactDeployProgress', statusListener);
      packageJob.on('artifactDeployCompleted', statusListener);

      // Act
      await packageJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const jobResults = await packageJob.deploy();

      // Assert
      expect(jobResults.length).to.equal(1);
      for (const res of jobResults) {
        expect(res.status).to.equal(DeployStatus.Enum.Success);
      }
      expect(oclifWrapperStub.args[0][0]).to.deep.equal({
        name: 'package:install',
        args: ['--target-org', $$.testTargetOrg.username, '--package', testNewVersionId, '--wait', '10', '--no-prompt'],
      });
      expect(statusListener.callCount).to.equal(3);
      expect(statusListener.args[0][0]).to.deep.contain({ status: ProcessingStatus.Started });
      expect(statusListener.args[1][0]).to.deep.contain({
        status: ProcessingStatus.InProgress,
        message: 'Running step 1 of 1 (PackageInstall): Installing 1.2.3 over 1.2.2',
      });
      expect(statusListener.args[2][0]).to.deep.contain({ status: ProcessingStatus.Completed });
    });

    it('should install package version with installation key > delegates to sf package install', async () => {
      // Arrange
      $$.resolvedPackageVersions[0].SubscriberPackageVersionId = '04t0X0000000001AAA';
      $$.resolvedPackageVersions[0].SubscriberPackageVersion.IsPasswordProtected = true;
      $$.installedPackageVersion[0].SubscriberPackageVersion.PatchVersion = 2;
      const oclifWrapperStub = $$.getOclifWrapperStub();
      const packageArtifact = structuredClone(MockNoSkipInstallPackage);
      packageArtifact.installation_key = 'APEX_UTILS_INSTALLATION_KEY';
      const packageJob = new ArtifactDeployJob('test_package', packageArtifact, TEST_MANIFEST);

      // Act
      await packageJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const jobResults = await packageJob.deploy();

      // Assert
      expect(jobResults.length).to.equal(1);
      for (const res of jobResults) {
        expect(res.status).to.equal(DeployStatus.Enum.Success);
      }
      expect(oclifWrapperStub.args[0][0]).to.deep.equal({
        name: 'package:install',
        args: [
          '--target-org',
          $$.testTargetOrg.username,
          '--package',
          testNewVersionId,
          '--wait',
          '10',
          '--no-prompt',
          '--installation-key',
          $$.installationKeyEnvVars.APEX_UTILS_INSTALLATION_KEY,
        ],
      });
    });

    it('should skip installation package version > step is skipped and command informed', async () => {
      // Arrange
      const oclifWrapperStub = $$.getOclifWrapperStub();

      // Act
      const packageJob = new ArtifactDeployJob('test_package', MockSkipInstallPackage, TEST_MANIFEST);
      await packageJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const installResult = await packageJob.getSteps()[0].deploy();

      // Assert
      expect(oclifWrapperStub.called).to.be.false;
      expect(installResult.status).to.equal(DeployStatus.Enum.Skipped);
    });
  });

  describe('unpackage source deploy jobs', () => {
    const $$ = new ManifestTestContext();

    const MockHappySoupArtifact: ZUnpackagedSourceArtifact = {
      type: 'Unpackaged',
      path: 'test/data/mock-src/unpackaged/my-happy-soup',
    };
    const MultiPathCoreOverrides: ZUnpackagedSourceArtifact = {
      type: 'Unpackaged',
      path: {
        dev: 'test/data/mock-src/package-overrides/core-crm/dev',
        prod: 'test/data/mock-src/package-overrides/core-crm/prod',
      },
    };

    beforeEach(async () => {
      $$.testDevHub.username = 'devhub-admin@example.com';
      $$.testTargetOrg.username = 'admin@example.com.dev';
      await $$.init();
    });

    afterEach(async () => {
      $$.restore();
    });

    it('has single source path > resolves to one step with path', async () => {
      // Act
      const sourceJob = new ArtifactDeployJob('org_shape', MockHappySoupArtifact, TEST_MANIFEST);
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const steps = await sourceJob.resolve(targetConnection, devhubConnection);

      // Assert
      expect(steps.length).to.equal(1, steps.toString());
      const deployStep = steps[0] as ZSourceDeployResultType;
      expect(deployStep.deployStrategy).to.equal('SourceDeploy');
      expect(deployStep.status).to.equal('Resolved');
      expect(deployStep.sourcePath).to.equal('test/data/mock-src/unpackaged/my-happy-soup');
    });

    it('has multi-env source paths > resolves to mapped target org path', async () => {
      // Act
      const qaSourceJob = new ArtifactDeployJob('core_overrides', MultiPathCoreOverrides, TEST_MANIFEST);
      const prodSourceJob = new ArtifactDeployJob('core_overrides', MultiPathCoreOverrides, TEST_MANIFEST);
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const stepsResolvedToQa = await qaSourceJob.resolve(targetConnection, devhubConnection);
      const stepsResolvedToProd = await prodSourceJob.resolve(devhubConnection, devhubConnection);

      // Assert
      expect(stepsResolvedToQa.length).to.equal(1, stepsResolvedToQa.toString());
      const qaDeployStep = stepsResolvedToQa[0] as ZSourceDeployResultType;
      expect(qaDeployStep.deployStrategy).to.equal('SourceDeploy');
      expect(qaDeployStep.status).to.equal('Resolved');
      expect(qaDeployStep.sourcePath).to.equal('test/data/mock-src/package-overrides/core-crm/dev');
      const prodDeployStep = stepsResolvedToProd[0] as ZSourceDeployResultType;
      expect(prodDeployStep.sourcePath).to.equal('test/data/mock-src/package-overrides/core-crm/prod');
    });

    it('has no source path configured for a valid and mapped env > envs are strict > skips job', async () => {
      // Arrange
      const STRICT_MANIFEST = structuredClone(TEST_MANIFEST.data);
      STRICT_MANIFEST.options.strict_environments = true;
      const mockArtifact: ZArtifactType = {
        type: 'Unpackaged',
        path: {
          prod: 'test/data/mock-src/package-overrides/core-crm/prod',
        },
      };

      // Act
      const qaSourceJob = new ArtifactDeployJob('core_overrides', mockArtifact, new OrgManifest(STRICT_MANIFEST));
      const prodSourceJob = new ArtifactDeployJob('core_overrides', mockArtifact, new OrgManifest(STRICT_MANIFEST));
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const stepsResolvedToQa = await qaSourceJob.resolve(targetConnection, devhubConnection);
      const stepsResolvedToProd = await prodSourceJob.resolve(devhubConnection, devhubConnection);

      // Assert
      expect(stepsResolvedToQa.length).to.equal(1, stepsResolvedToQa.toString());
      const qaDeployStep = stepsResolvedToQa[0] as ZSourceDeployResultType;
      expect(qaDeployStep.deployStrategy).to.equal('SourceDeploy');
      expect(qaDeployStep.status).to.equal('Skipped');
      expect(qaDeployStep.sourcePath).to.be.undefined;
      const prodDeployStep = stepsResolvedToProd[0] as ZSourceDeployResultType;
      expect(prodDeployStep.status).to.equal('Resolved');
      expect(prodDeployStep.sourcePath).to.equal('test/data/mock-src/package-overrides/core-crm/prod');
    });

    it('has multi-env source paths > no env configured and envs are not strict > resolves empty and skips', async () => {
      // Arrange
      const MANIFEST_NO_ENVS = structuredClone(TEST_MANIFEST.data);
      MANIFEST_NO_ENVS.environments = undefined;
      MANIFEST_NO_ENVS.options.strict_environments = false;

      // Act
      const sourceJob = new ArtifactDeployJob(
        'core_overrides',
        MultiPathCoreOverrides,
        new OrgManifest(MANIFEST_NO_ENVS)
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();
      const stepsResolvedToQa = await sourceJob.resolve(targetConnection, devhubConnection);

      // Assert
      const qaDeployStep = stepsResolvedToQa[0] as ZSourceDeployResultType;
      expect(qaDeployStep.status).to.equal('Skipped');
      expect(qaDeployStep.sourcePath).to.equal(undefined);
    });

    it('has no envs configured in manifest but envs are strict > throws error', async () => {
      // Arrange
      const MANIFEST_NO_ENVS = structuredClone(TEST_MANIFEST.data);
      MANIFEST_NO_ENVS.environments = undefined;
      MANIFEST_NO_ENVS.options.strict_environments = true;

      // Act
      const sourceJob = new ArtifactDeployJob(
        'core_overrides',
        MultiPathCoreOverrides,
        new OrgManifest(MANIFEST_NO_ENVS)
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();

      // Assert
      try {
        await sourceJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.message).to.equal(
            `No environment configured for target org ${$$.testTargetOrg.username}, but strict validation was set.`
          );
        }
      }
    });

    it('has no env for username configured but envs are strict > throws error', async () => {
      // Arrange
      const MANIFEST = structuredClone(TEST_MANIFEST.data);
      MANIFEST.environments = {
        dev: 'admin2@example.com.dev',
        stage: 'admin2@example.com.stage',
        prod: 'devhub-admin2@example.com',
      };
      MANIFEST.options.strict_environments = true;

      // Act
      const sourceJob = new ArtifactDeployJob(
        'core_overrides',
        {
          type: 'Unpackaged',
          path: {
            prod: 'test/data/mock-src/package-overrides/core-crm/prod',
          },
        },
        new OrgManifest(MANIFEST)
      );
      const devhubConnection = await $$.testDevHub.getConnection();
      const targetConnection = await $$.testTargetOrg.getConnection();

      // Assert
      try {
        await sourceJob.resolve(targetConnection, devhubConnection);
        expect.fail('Should throw an error, but resolved');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        if (err instanceof SfError) {
          expect(err.message).to.equal(
            `No environment configured for target org ${$$.testTargetOrg.username}, but strict validation was set.`
          );
        }
      }
    });

    it('rollout with single source path > delegates to sf project deploy start', async () => {
      // Arrange
      const oclifWrapperStub = $$.getOclifWrapperStub();

      // Act
      const sourceJob = new ArtifactDeployJob('org_shape', MockHappySoupArtifact, TEST_MANIFEST);
      const targetConnection = await $$.testTargetOrg.getConnection();
      await sourceJob.resolve(targetConnection, await $$.testDevHub.getConnection());
      const deployResult = await sourceJob.getSteps()[0].deploy();

      // Assert
      expect(deployResult.status).to.equal(DeployStatus.Enum.Success);
      expect(oclifWrapperStub.args[0][0]).to.deep.equal({
        name: 'project:deploy:start',
        args: [
          '--target-org',
          $$.testTargetOrg.username,
          '--source-dir',
          'test/data/mock-src/unpackaged/my-happy-soup',
          '--wait',
          '10',
        ],
      });
    });

    it('rollout with no resolved source > skips sf project deploy', async () => {
      // Arrange
      // target connection is a mapped env, but no source path is configured
      const multiPathUnpackaged: ZUnpackagedSourceArtifact = {
        type: 'Unpackaged',
        path: {
          dev: '',
          prod: 'test/data/mock-src/package-overrides/core-crm/prod',
        },
      };
      const oclifWrapperStub = $$.getOclifWrapperStub();

      // Act
      const sourceJob = new ArtifactDeployJob('core_overrides', multiPathUnpackaged, TEST_MANIFEST);
      await sourceJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const deployResult = await sourceJob.getSteps()[0].deploy();

      // Assert
      expect(deployResult.status).to.equal(DeployStatus.Enum.Skipped);
      expect(oclifWrapperStub.called).to.be.false;
    });

    it('ignores empty flags key in artifact definition', async () => {
      // Arrange
      const testUnpackagedArtifact: ZUnpackagedSourceArtifact = {
        type: 'Unpackaged',
        path: 'test/data/mock-src/unpackaged/org-shape',
        flags: '',
      };
      const oclifWrapperStub = $$.getOclifWrapperStub();

      // Act
      const sourceJob = new ArtifactDeployJob('org_shape', testUnpackagedArtifact, TEST_MANIFEST);
      await sourceJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const deployResult = await sourceJob.getSteps()[0].deploy();

      // Assert
      expect(deployResult.status).to.equal(DeployStatus.Enum.Success);
      expect(oclifWrapperStub.args.flat()[0]).to.deep.equal({
        name: 'project:deploy:start',
        args: ['--target-org', $$.testTargetOrg.username, '--source-dir', testUnpackagedArtifact.path, '--wait', '10'],
      });
    });

    it('ignores obviously invalid flags in artifact definition', async () => {
      // Arrange
      const testUnpackagedArtifact: ZUnpackagedSourceArtifact = {
        type: 'Unpackaged',
        path: 'test/data/mock-src/unpackaged/org-shape',
        flags: '===  === -a --ignore-conflicts',
      };
      const oclifWrapperStub = $$.getOclifWrapperStub();

      // Act
      const sourceJob = new ArtifactDeployJob('org_shape', testUnpackagedArtifact, TEST_MANIFEST);
      await sourceJob.resolve(await $$.testTargetOrg.getConnection(), await $$.testDevHub.getConnection());
      const deployResult = await sourceJob.getSteps()[0].deploy();

      // Assert
      expect(deployResult.status).to.equal(DeployStatus.Enum.Success);
      expect(oclifWrapperStub.args.flat()[0]).to.deep.equal({
        name: 'project:deploy:start',
        args: [
          '--target-org',
          $$.testTargetOrg.username,
          '--source-dir',
          testUnpackagedArtifact.path,
          '--wait',
          '10',
          '--ignore-conflicts',
        ],
      });
    });
  });
});
