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

describe('jsc manifest rollout', () => {
  const $$ = new TestContext();
  let testDevHub: MockTestOrgData;
  let testTargetOrg: MockTestOrgData;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(() => {
    testDevHub = new MockTestOrgData();
    testDevHub.isDevHub = true;
    testTargetOrg = new MockTestOrgData();
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.SANDBOX);
    initSourceDirectories();
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs command with json flag > minimal manifest => exits OK', async () => {
    // Arrange
    await $$.stubAuths(testDevHub, testTargetOrg);

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
    await $$.stubAuths(testDevHub, testTargetOrg);
    mockSubscriberVersionsForAllPackages();
    process.env.APEX_UTILS_INSTALLATION_KEY = '123apexkey';
    process.env.LWC_UTILS_INSTALLATION_KEY = '123lwckey';

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

  function mockSubscriberVersionsForAllPackages() {
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
