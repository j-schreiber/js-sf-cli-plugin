/* eslint-disable camelcase */
import fs from 'node:fs';
import { SinonStub } from 'sinon';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson, Dictionary, ensureJsonMap, ensureString, entriesOf } from '@salesforce/ts-types';
import { eventBus } from '../../src/common/comms/eventBus.js';
import { InstalledSubscriberPackage, Package2Version } from '../../src/types/sfToolingApiTypes.js';
import OclifUtils, { CommandResult } from '../../src/common/utils/wrapChildprocess.js';
import { ZReleaseManifestType } from '../../src/types/orgManifestInputSchema.js';
import OrgManifest from '../../src/release-manifest/OrgManifest.js';

export const RESOLVED_PACKAGE_VERSIONS = [
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

export const INSTALLED_PACKAGE_VERSIONS = [
  {
    SubscriberPackageVersionId: '04t0X0000000001AAA',
    SubscriberPackageVersion: {
      MajorVersion: 1,
      MinorVersion: 2,
      PatchVersion: 3,
      IsPasswordProtected: false,
      IsBeta: false,
    },
  },
];

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

export const TEST_MANIFEST = {
  options: DEFAULT_MANIFEST_OPTIONS,
  environments: TEST_ENVS,
  artifacts: {},
} as ZReleaseManifestType;

/**
 * Centralized setup of mocks and stubs to test release manifest related functionality.
 * To use, initialise a new instance, then override / set all public properties, then
 * run `init()` to prepare all mocks.
 */
export default class ManifestTestContext {
  public $$: TestContext;
  public testDevHub: MockTestOrgData;
  public testTargetOrg: MockTestOrgData;

  /**
   * The result returned by the DevHub, if a descriptive package version (e.g. 1.2.3)
   * is resolved. Set this to an empty list, if the version should not resolve to
   * an existing package version on the dev hub.
   */
  public resolvedPackageVersions: Package2Version[];

  /**
   * The result that will be returned by target org for the specific installed
   * package version. Set to empty list, if no package is installed. The default
   * installed version is identical to the resolved package version.
   */
  public installedPackageVersion: InstalledSubscriberPackage[];

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

  public constructor() {
    this.$$ = new TestContext();
    this.testDevHub = new MockTestOrgData();
    this.testDevHub.isDevHub = true;
    this.testTargetOrg = new MockTestOrgData();
    this.resolvedPackageVersions = structuredClone(RESOLVED_PACKAGE_VERSIONS);
    this.installedPackageVersion = structuredClone(INSTALLED_PACKAGE_VERSIONS);
  }

  public async init() {
    this.$$.fakeConnectionRequest = this.mockPackageResolveQueries;
    setInstallationKeyEnvVars(this.installationKeyEnvVars);
    initSourceDirectories(this.testSourcePaths);
    await this.$$.stubAuths(this.testDevHub, this.testTargetOrg);
  }

  /**
   * Call this in `afterEach` hook to restore all sandboxes and reset
   * all query-result mocks.
   */
  public restore() {
    this.resolvedPackageVersions = structuredClone(RESOLVED_PACKAGE_VERSIONS);
    this.installedPackageVersion = structuredClone(INSTALLED_PACKAGE_VERSIONS);
    clearEnvVars(this.installationKeyEnvVars);
    eventBus.removeAllListeners();
    cleanSourceDirectories();
    process.removeAllListeners();
  }

  /**
   * Returns the 0Ho package id of the mocked package
   */
  public getPackageId(): string {
    return this.resolvedPackageVersions[0].Package2.Id;
  }

  /**
   * Returns the 04t id of the installed subscriber package
   * from mocks
   */
  public getInstalledSubscriberPackageVersionId(): string {
    return this.installedPackageVersion[0].SubscriberPackageVersionId;
  }

  /**
   * Returns a default sinon stub around the cmd executor.
   *
   * @param cmdResult
   * @returns
   */
  public getOclifWrapperStub(cmdResult?: CommandResult): SinonStub {
    return this.$$.SANDBOX.stub(OclifUtils, 'execCoreCommand').resolves(
      cmdResult ?? {
        status: 0,
        result: { status: 0, message: 'Success' },
      }
    );
  }

  private mockPackageResolveQueries = (request: AnyJson): Promise<AnyJson> => {
    if (this.isPackageVersionDevhubQuery(request)) {
      return Promise.resolve({ records: this.resolvedPackageVersions });
    } else if (this.isTargetOrgInstalledVersionQuery(request)) {
      return Promise.resolve({ records: this.installedPackageVersion });
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

/**
 * Initialises a new org manifest instance. Each instance is created
 * from a fresh deep-clone of the manifest template that can safely
 * be manipulated within tests.
 *
 * @returns
 */
export function newOrgManifest(): OrgManifest {
  return new OrgManifest(structuredClone(TEST_MANIFEST));
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
