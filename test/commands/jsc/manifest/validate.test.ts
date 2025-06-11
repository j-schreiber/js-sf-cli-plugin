import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import JscManifestValidate from '../../../../src/commands/jsc/manifest/validate.js';
import { DeployStatus } from '../../../../src/types/orgManifestGlobalConstants.js';
import ManifestTestContext from '../../../mock-utils/manifestTestContext.js';

describe('jsc manifest validate', () => {
  const $$ = new ManifestTestContext();
  let oclifWrapperStub: SinonStub;
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(async () => {
    await $$.init();
    sfCommandStubs = stubSfCommandUx($$.$$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.$$.SANDBOX);
    oclifWrapperStub = $$.getOclifWrapperStub();
  });

  afterEach(() => {
    oclifWrapperStub.restore();
    $$.restore();
  });

  it('runs with --json flag > returns resolved artifacts', async () => {
    // Act
    const result = await JscManifestValidate.run([
      '--devhub-org',
      $$.testDevHub.username,
      '--target-org',
      $$.testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
      '--json',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(Object.keys(result.deployedArtifacts)).to.deep.equal(['basic_happy_soup']);
    expect(oclifWrapperStub.callCount).to.equal(0);
    expect(result.deployedArtifacts['basic_happy_soup'][0].status).to.equal(DeployStatus.Enum.Resolved);
    expect(result.targetOrgUsername).to.equal($$.testTargetOrg.username);
    expect(result.devhubOrgUsername).to.equal($$.testDevHub.username);
  });

  it('runs with human output > shows spinner for artifacts', async () => {
    // Act
    const result = await JscManifestValidate.run([
      '--devhub-org',
      $$.testDevHub.username,
      '--target-org',
      $$.testTargetOrg.username,
      '--manifest',
      'test/data/manifests/minimal.yaml',
    ]);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(sfCommandStubs.info.args.flat()).to.deep.equal([
      `Target org for rollout: ${$$.testTargetOrg.username}`,
      `Devhub to resolve packages: ${$$.testDevHub.username}`,
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

  it('validates yaml with syntactically correct flags', async () => {
    // Act
    const result = await JscManifestValidate.run([
      '--devhub-org',
      $$.testDevHub.username,
      '--target-org',
      $$.testTargetOrg.username,
      '--manifest',
      'test/data/manifests/with-flags.yaml',
    ]);

    // Assert
    expect(result.deployedArtifacts['org_shape_settings'][0].status).to.equal(DeployStatus.Enum.Resolved);
    expect(result.deployedArtifacts['apex_utils'][0].status).to.equal(DeployStatus.Enum.Resolved);
  });
});
