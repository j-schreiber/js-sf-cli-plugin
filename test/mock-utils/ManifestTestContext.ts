import fs from 'node:fs';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, Dictionary, ensureJsonMap, ensureString, entriesOf } from '@salesforce/ts-types';
import { eventBus } from '../../src/common/comms/eventBus.js';

/**
 * Centralized setup of mocks and stubs to test release manifest related functionality.
 * To use, initialise a new instance, then override / set all public properties, then
 * run `init()` to prepare all mocks.
 */
export default class ManifestTextContext {
  public $$ = new TestContext();
  public testDevHub = new MockTestOrgData();
  public testTargetOrg = new MockTestOrgData();

  public existingPackageVersions = [
    {
      SubscriberPackageVersionId: '04t0X0000000001AAA',
      IsReleased: true,
      SubscriberPackageVersion: {
        MajorVersion: 1,
        MinorVersion: 2,
        PatchVersion: 3,
        IsBeta: false,
        IsPasswordProtected: false,
      },
      Package2: {
        Id: '0Ho000000000000AAA',
        SubscriberPackageId: '033000000000000AAA',
      },
    },
  ];

  public installedPackageVersion = {
    SubscriberPackageVersionId: '04t0X0000000001AAA',
    SubscriberPackageVersion: {
      MajorVersion: 1,
      MinorVersion: 2,
      PatchVersion: 2,
      IsPasswordProtected: false,
      IsBeta: false,
    },
  };

  public testSourcePaths = [
    'test/data/mock-src/package-overrides/core-crm/dev',
    'test/data/mock-src/package-overrides/core-crm/prod',
    'test/data/mock-src/package-overrides/pims',
    'test/data/mock-src/package-extensions/core-crm',
    'test/data/mock-src/unpackaged/org-shape',
    'test/data/mock-src/unpackaged/qa',
    'test/data/mock-src/unpackaged/prod-only',
    'test/data/mock-src/unpackaged/my-happy-soup',
  ];

  public installationKeyEnvVars = {
    APEX_UTILS_INSTALLATION_KEY: 'apex123',
    LWC_UTILS_INSTALLATION_KEY: 'lwc123',
    CORE_INSTALLATION_KEY: 'core123',
    PIMS_INSTALLATION_KEY: 'pims123',
  };

  public async init() {
    this.testDevHub.isDevHub = true;
    this.$$.fakeConnectionRequest = this.mockPackageResolveQueries;
    setInstallationKeyEnvVars(this.installationKeyEnvVars);
    initSourceDirectories(this.testSourcePaths);
    await this.$$.stubAuths(this.testDevHub, this.testTargetOrg);
  }

  // eslint-disable-next-line class-methods-use-this
  public reset() {
    clearEnvVars(this.installationKeyEnvVars);
    eventBus.removeAllListeners();
    cleanSourceDirectories();
    process.removeAllListeners();
  }

  private mockPackageResolveQueries = (request: AnyJson): Promise<AnyJson> => {
    if (this.isPackageVersionDevhubQuery(request)) {
      return Promise.resolve({ records: this.existingPackageVersions });
    } else if (this.isTargetOrgInstalledVersionQuery(request)) {
      return Promise.resolve({ records: [this.installedPackageVersion] });
    } else {
      return Promise.resolve({ records: [] });
    }
  };

  private isPackageVersionDevhubQuery(request: AnyJson): boolean {
    const ensuredRequest = ensureJsonMap(request);
    return Boolean(request && ensureString(ensuredRequest.url).includes(this.testDevHub.instanceUrl));
  }

  private isTargetOrgInstalledVersionQuery(request: AnyJson): boolean {
    const ensuredRequest = ensureJsonMap(request);
    return Boolean(request && ensureString(ensuredRequest.url).includes(this.testTargetOrg.instanceUrl));
  }
}

export function initSourceDirectories(testSourcePaths: string[]) {
  testSourcePaths.forEach((path) => {
    fs.mkdirSync(path, { recursive: true });
    fs.cpSync('test/data/test-sfdx-project/src/classes', `${path}/classes`, { recursive: true });
  });
}

function cleanSourceDirectories() {
  fs.rmSync('test/data/mock-src', { recursive: true });
}

function clearEnvVars(entries: Dictionary<string>) {
  for (const [key] of entriesOf(entries)) {
    delete process.env[key];
  }
}

function setInstallationKeyEnvVars(entries: Dictionary<string>) {
  for (const [key, value] of entriesOf(entries)) {
    process.env[key] = value;
  }
}
