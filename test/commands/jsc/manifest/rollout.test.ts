/* eslint-disable no-underscore-dangle */
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { SfError } from '@salesforce/core';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import JscManifestRollout from '../../../../src/commands/jsc/manifest/rollout.js';
import {
  cleanSourceDirectories,
  initSourceDirectories,
  MockInstalledVersionQueryResult,
  MockPackageVersionQueryResult,
} from '../../../mock-utils/releaseManifestMockUtils.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';
import OclifUtils from '../../../../src/common/utils/wrapChildprocess.js';
import { ZPackageInstallResultType, ZSourceDeployResultType } from '../../../../src/types/orgManifestOutputSchema.js';
import { DeployStatus } from '../../../../src/types/orgManifestGlobalConstants.js';

const MockLwcUtilsInstallationKey = 'lwcutils1234';
const MockVersionId = MockPackageVersionQueryResult.records[0].SubscriberPackageVersionId;

describe('jsc manifest rollout', () => {
  const $$ = new TestContext();
  const testDevHub = new MockTestOrgData();
  const testTargetOrg = new MockTestOrgData();
  let oclifWrapperStub: SinonStub;
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(async () => {
    testDevHub.isDevHub = true;
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.SANDBOX);
    initSourceDirectories();
    oclifWrapperStub = $$.SANDBOX.stub(OclifUtils, 'execCoreCommand').resolves({
      status: 0,
      result: { status: 0, message: 'Success' },
    });
    await $$.stubAuths(testDevHub, testTargetOrg);
  });

  afterEach(() => {
    oclifWrapperStub.restore();
    eventBus.removeAllListeners();
    cleanSourceDirectories();
    process.removeAllListeners();
  });

  it('runs command with json flag > unpackaged only manifest => exits OK', async () => {
    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(Object.keys(result.deployedArtifacts)).to.deep.equal(['basic_happy_soup']);
    expect(oclifWrapperStub.callCount).to.equal(1);
    // first param of first call is the command config we pass into ->
    // this is what we are interested in
    expect(oclifWrapperStub.args[0][0]).to.deep.equal({
      name: 'project:deploy:start',
      args: [
        '--target-org',
        testTargetOrg.username,
        '--source-dir',
        'test/data/mock-src/unpackaged/my-happy-soup',
        '--wait',
        '10',
      ],
    });
    expect(sfCommandStubs.info.args.flat()).to.deep.equal([
      `Target org for rollout: ${testTargetOrg.username}`,
      `Devhub to resolve packages: ${testDevHub.username}`,
    ]);
  });

  it('runs command with json flag > package manifest => exits OK', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/complex-with-global-options.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result).to.be.ok;
    expect(Object.keys(result.deployedArtifacts)).to.deep.equal(['apex_utils', 'lwc_utils']);
    expect(oclifWrapperStub.callCount).to.equal(1);
  });

  it('runs command with regular output > unpackaged manifest => shows details', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
    ]);

    // // Assert
    expect(process.exitCode).to.equal(0);
    expect(result).to.be.ok;
    expect(sfSpinnerStub.start.callCount).to.equal(2);
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 1 artifacts found', 'Rolling out basic_happy_soup (1 steps).'],
      'total arguments for spinner.start() calls'
    );
  });

  it('runs command with regular output > package manifest => shows details', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/complex-with-envs.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result).to.be.ok;
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      [
        'Resolving manifest: 8 artifacts found',
        'Rolling out org_shape_settings (1 steps).',
        'Rolling out apex_utils (1 steps).',
        'Rolling out lwc_utils (1 steps).',
        'Rolling out core_crm (1 steps).',
        'Rolling out core_crm_overrides (1 steps).',
        'Rolling out core_crm_extensions (1 steps).',
        'Rolling out pims (1 steps).',
        'Rolling out pims_overrides (1 steps).',
      ],
      'args for spinner.start() calls'
    );
    // all packages except apex_utils are expected to be Skipped
    // because we mock "same version installed"
    // core_crm_overrides skipped, because strict_envs is false and
    // the mapped paths resolve undefined for the target org
    expect(sfSpinnerStub.stop.args.flat()).to.deep.equal(
      [
        'Success! All artifacts resolved.', // validation
        'Deployed test/data/mock-src/unpackaged/org-shape.', // org_shape_settings
        `Installed 1.28.0 (${MockVersionId}).`, // apex_utils has skip_if_installed = false
        `Skipped. 0.12.0 (${MockVersionId}) already installed.`, // lwc_utils
        `Skipped. 2.4.2 (${MockVersionId}) already installed.`, // core_crm
        'Skipped. Resolves to empty path.', // core_crm_overrides resolves to empty path
        'Deployed test/data/mock-src/package-extensions/core-crm.', // core_crm_extensions
        `Skipped. 2.9.0 (${MockVersionId}) already installed.`, // pims
        'Deployed test/data/mock-src/package-overrides/pims.', // pims_overrides
      ],
      'args for spinner.stop() calls'
    );
  });

  it('has failing artifact and no-json run => exits error & log details', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();
    const subCommandError = { status: 1, message: 'Complex error from child process' };
    oclifWrapperStub.restore();
    oclifWrapperStub = $$.SANDBOX.stub(OclifUtils, 'execCoreCommand').resolves({ status: 1, result: subCommandError });

    // Act
    try {
      await JscManifestRollout.run([
        '--devhub-org',
        testDevHub.username,
        '--target-org',
        testTargetOrg.username,
        '--manifest',
        'test/data/manifests/minimal.yaml',
      ]);
      expect.fail('Expected exception, but succeeded');
    } catch (e) {
      if (e instanceof SfError) {
        expect(e.message).to.equal(JSON.stringify(subCommandError, null, 2));
      } else {
        expect.fail('Expected SfError');
      }
    }

    // Assert
    expect(process.exitCode).to.equal(2);
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 1 artifacts found', 'Rolling out basic_happy_soup (1 steps).'],
      'args for spinner.start() calls'
    );
    // these asserts fail when run with "yarn test" script
    // Expects "\u001b[1m\u001b[31mError\u001b[39m\u001b[22m" instead of "Error"
    // has to be related to the fact the the process exits with this.error(...),
    // which is formatted in output
    // expect(sfSpinnerStub.stop.args.flat()).to.deep.equal(
    //   [
    //     'Success! All artifacts resolved.', // validation
    //     'Error', // basic_happy_soup
    //   ],
    //   'args for spinner.stop() calls'
    // );
    expect(sfCommandStubs.logToStderr.called).to.be.true;
  });

  it('has failing artifact but runs with --json => exits result without exception', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();
    const subCommandError = { status: 1, message: 'Complex error from child process' };
    oclifWrapperStub.restore();
    oclifWrapperStub = $$.SANDBOX.stub(OclifUtils, 'execCoreCommand').resolves({ status: 1, result: subCommandError });

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
      '--json',
    ]);

    // Assert
    expect(process.exitCode).to.equal(2);
    expect(result.deployedArtifacts['basic_happy_soup']).to.not.be.undefined;
    expect(result.deployedArtifacts['basic_happy_soup'].length).to.equal(1, 'steps in basic_happy_soup');
    const happySoupResult = result.deployedArtifacts['basic_happy_soup'][0] as unknown as ZSourceDeployResultType;
    expect(happySoupResult.status).to.equal(DeployStatus.Enum.Failed);
    expect(happySoupResult.errorDetails).to.equal(subCommandError);
  });

  it('first artifact fails with --json flag => aborts execution immediately', async () => {
    // Arrange
    mockSubscriberVersionsForAllPackages();
    const subCommandError = { status: 1, message: 'Complex error from child process' };
    oclifWrapperStub.restore();
    oclifWrapperStub = $$.SANDBOX.stub(OclifUtils, 'execCoreCommand').resolves({ status: 1, result: subCommandError });

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/simple-multi-step.yaml',
      '--json',
    ]);

    // Assert
    expect(process.exitCode).to.equal(2);
    expect(result.deployedArtifacts['basic_happy_soup']).to.not.be.undefined;
    expect(result.deployedArtifacts['apex_utils']).to.not.be.undefined;
    expect(result.deployedArtifacts['basic_happy_soup'].length).to.equal(1, 'steps in basic_happy_soup');
    expect(result.deployedArtifacts['apex_utils'].length).to.equal(1, 'steps in apex_utils');
    const apexUtilsResult = result.deployedArtifacts['basic_happy_soup'][0] as unknown as ZSourceDeployResultType;
    expect(apexUtilsResult.status).to.equal(DeployStatus.Enum.Failed);
    expect(apexUtilsResult.errorDetails).to.equal(subCommandError);
    const lwcUtilsResult = result.deployedArtifacts['apex_utils'][0] as unknown as ZPackageInstallResultType;
    expect(lwcUtilsResult.status).to.equal(DeployStatus.Enum.Skipped);
    expect(lwcUtilsResult.displayMessage).to.equal('Skipped, because a previous artifact failed.');
  });

  it('runs unpackaged only manifest in non-DX directory => throws error', async () => {
    // Arrange
    $$.inProject(false);

    // Act
    try {
      await JscManifestRollout.run([
        '--devhub-org',
        testDevHub.username,
        '--target-org',
        testTargetOrg.username,
        '--manifest',
        'test/data/manifests/minimal.yaml',
      ]);
      expect.fail('Expected exception, but succeeded');
    } catch (e) {
      if (e instanceof SfError) {
        expect(e.name).to.equal('RequiresProjectError');
      } else {
        expect.fail('Expected SfError');
      }
    }

    // Assert
    expect(process.exitCode).to.equal(2);
  });

  it('runs package manifest in non-DX directory => exits OK', async () => {
    // Arrange
    $$.inProject(false);
    mockSubscriberVersionsForAllPackages();

    // Act
    const result = await JscManifestRollout.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/complex-with-global-options.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result).to.be.ok;
  });

  function mockSubscriberVersionsForAllPackages() {
    process.env.APEX_UTILS_INSTALLATION_KEY = '123apexkey';
    process.env.LWC_UTILS_INSTALLATION_KEY = MockLwcUtilsInstallationKey;
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      if (isPackageVersionDevhubQuery(request)) {
        return Promise.resolve(MockPackageVersionQueryResult);
      } else if (isTargetOrgInstalledVersionQuery(request)) {
        const returnValue = structuredClone(MockInstalledVersionQueryResult);
        returnValue.records[0].SubscriberPackageVersionId =
          MockPackageVersionQueryResult.records[0].SubscriberPackageVersionId;
        return Promise.resolve(returnValue);
      } else {
        return Promise.resolve({ records: [] });
      }
    };
  }

  function isPackageVersionDevhubQuery(request: AnyJson): boolean {
    const _request = ensureJsonMap(request);
    return Boolean(request && ensureString(_request.url).includes(testDevHub.instanceUrl));
  }

  function isTargetOrgInstalledVersionQuery(request: AnyJson): boolean {
    const _request = ensureJsonMap(request);
    return Boolean(request && ensureString(_request.url).includes(testTargetOrg.instanceUrl));
  }
});
