/* eslint-disable no-underscore-dangle */
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { cleanSourceDirectories, initSourceDirectories } from '../../../mock-utils/releaseManifestMockUtils.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';
import OclifUtils from '../../../../src/common/utils/wrapChildprocess.js';
import JscManifestValidate from '../../../../src/commands/jsc/manifest/validate.js';
import { DeployStatus } from '../../../../src/types/orgManifestGlobalConstants.js';

describe('jsc manifest validate', () => {
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

  it('runs with --json flag > returns resolved artifacts', async () => {
    // Act
    const result = await JscManifestValidate.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
      '--json',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(Object.keys(result.deployedArtifacts)).to.deep.equal(['basic_happy_soup']);
    expect(oclifWrapperStub.callCount).to.equal(0);
    expect(result.deployedArtifacts['basic_happy_soup'][0].status).to.equal(DeployStatus.Enum.Resolved);
    expect(result.targetOrgUsername).to.equal(testTargetOrg.username);
    expect(result.devhubOrgUsername).to.equal(testDevHub.username);
  });

  it('runs with human output > shows spinner for artifacts', async () => {
    // Act
    const result = await JscManifestValidate.run([
      '--devhub-org',
      testDevHub.username,
      '--target-org',
      testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(sfCommandStubs.info.args.flat()).to.deep.equal([
      `Target org for rollout: ${testTargetOrg.username}`,
      `Devhub to resolve packages: ${testDevHub.username}`,
    ]);
    expect(result).to.be.ok;
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 1 artifacts found'],
      'args for spinner.start() calls'
    );
    expect(sfSpinnerStub.stop.args.flat()).to.deep.equal(
      [
        'Success! All artifacts resolved.', // validation
      ],
      'args for spinner.stop() calls'
    );
  });
});
