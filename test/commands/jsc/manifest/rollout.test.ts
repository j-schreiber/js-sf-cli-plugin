/* eslint-disable no-underscore-dangle */
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { SfError } from '@salesforce/core';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import JscManifestRollout from '../../../../src/commands/jsc/manifest/rollout.js';
import {
  initSourceDirectories,
  MockInstalledVersionQueryResult,
  MockPackageVersionQueryResult,
} from '../../../mock-utils/releaseManifestMockUtils.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';
import OclifUtils from '../../../../src/common/utils/wrapChildprocess.js';

const MockLwcUtilsInstallationKey = 'lwcutils1234';

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
  });

  it('runs command with json flag > minimal manifest => exits OK', async () => {
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
    expect(result).to.be.ok;
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
      'test/data/manifests/complex-non-defaults.yaml',
    ]);

    // Assert
    expect(result).to.be.ok;
    expect(Object.keys(result.deployedArtifacts)).to.deep.equal(['apex_utils', 'lwc_utils']);
    expect(oclifWrapperStub.callCount).to.equal(1);
  });

  it('runs command with regular output > minimal manifest => shows details', async () => {
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
        'Completed with success.', // org_shape_settings
        'Completed with success.', // apex_utils has skip_if_installed = false
        'Artifact skipped.', // lwc_utils
        'Artifact skipped.', // core_crm
        'Artifact skipped.', // core_crm_overrides resolves to empty path
        'Completed with success.', // core_crm_extensions
        'Artifact skipped.', // pims
        'Completed with success.', // pims_overrides
      ],
      'args for spinner.stop() calls'
    );
  });

  it('has failing artifact with console output => exits error & shows details', async () => {
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
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 1 artifacts found', 'Rolling out basic_happy_soup (1 steps).'],
      'args for spinner.start() calls'
    );
    expect(sfSpinnerStub.stop.args.flat()).to.deep.equal(
      [
        'Success! All artifacts resolved.', // validation
        'Error', // basic_happy_soup
      ],
      'args for spinner.stop() calls'
    );
    expect(sfCommandStubs.logToStderr.called).to.be.true;
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
