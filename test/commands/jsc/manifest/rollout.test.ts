/* eslint-disable no-underscore-dangle */
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import JscManifestRollout from '../../../../src/commands/jsc/manifest/rollout.js';
import {
  initSourceDirectories,
  MockInstalledVersionQueryResult,
  MockPackageVersionQueryResult,
} from '../../../mock-utils/releaseManifestMockUtils.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';

describe('jsc manifest rollout', () => {
  const $$ = new TestContext();
  const testDevHub = new MockTestOrgData();
  const testTargetOrg = new MockTestOrgData();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(async () => {
    testDevHub.isDevHub = true;
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.SANDBOX);
    initSourceDirectories();
    await $$.stubAuths(testDevHub, testTargetOrg);
  });

  afterEach(() => {
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
    // how to get chai/mocha to show the problems in diffs,
    // instead of only displaying "expect [Array(n) ] when fail?"
    expect(sfSpinnerStub.start.callCount).to.equal(1);
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 1 artifacts found'],
      'total arguments for spinner.start() calls'
    );
    expect(sfCommandStubs.log.args.flat()).to.deep.equal([
      'Starting rollout for basic_happy_soup. Executing 1 steps.',
      `Running "sf project deploy start" with test/data/mock-src/unpackaged/my-happy-soup on ${testTargetOrg.username}`,
      'Completed basic_happy_soup!',
    ]);
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
    // TODO how to get chai/mocha to show the problems in diffs,
    // instead of only displaying "expect [Array(n) ] when fail?"
    expect(sfSpinnerStub.start.args.flat()).to.deep.equal(
      ['Resolving manifest: 8 artifacts found'],
      'total arguments for spinner.start() calls'
    );
    expect(sfCommandStubs.log.callCount).to.equal(8 * 3, '3 log lines per artifact');
  });

  function mockSubscriberVersionsForAllPackages() {
    process.env.APEX_UTILS_INSTALLATION_KEY = '123apexkey';
    process.env.LWC_UTILS_INSTALLATION_KEY = '123lwckey';
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
