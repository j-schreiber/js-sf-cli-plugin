/* eslint-disable camelcase */
import fs from 'node:fs';
import OrgManifest from '../../src/release-manifest/OrgManifest.js';
import { ZReleaseManifestType } from '../../src/types/orgManifestInputSchema.js';

export const testSourcePaths = [
  'test/data/mock-src/package-overrides/core-crm/dev',
  'test/data/mock-src/package-overrides/core-crm/prod',
  'test/data/mock-src/package-overrides/pims',
  'test/data/mock-src/package-extensions/core-crm',
  'test/data/mock-src/unpackaged/org-shape',
  'test/data/mock-src/unpackaged/qa',
  'test/data/mock-src/unpackaged/prod-only',
  'test/data/mock-src/unpackaged/my-happy-soup',
];

export const MockInstalledVersionQueryResult = {
  records: [
    {
      SubscriberPackageVersionId: '04t0X0000000000AAA',
      SubscriberPackageVersion: {
        MajorVersion: 1,
        MinorVersion: 2,
        PatchVersion: 2,
        IsPasswordProtected: false,
        IsBeta: false,
      },
    },
  ],
};

export const MockPackageVersionQueryResult = {
  records: [
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
  ],
};

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

const TEST_MANIFEST = {
  options: DEFAULT_MANIFEST_OPTIONS,
  environments: TEST_ENVS,
  artifacts: {},
} as ZReleaseManifestType;

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

export function initSourceDirectories() {
  testSourcePaths.forEach((path) => {
    fs.mkdirSync(path, { recursive: true });
    fs.cpSync('test/data/test-sfdx-project/src/classes', `${path}/classes`, { recursive: true });
  });
}

export function cleanSourceDirectories() {
  fs.rmSync('test/data/mock-src', { recursive: true });
}
