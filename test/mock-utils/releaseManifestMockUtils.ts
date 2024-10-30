import fs from 'node:fs';

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
        MajorVersion: '1',
        MinorVersion: '2',
        PatchVersion: '2',
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
        MajorVersion: '1',
        MinorVersion: '2',
        PatchVersion: '3',
        IsBeta: false,
        IsPasswordProtected: false,
      },
      Package2: {
        SubscriberPackageId: '033000000000000AAA',
      },
    },
  ],
};

export function initSourceDirectories() {
  testSourcePaths.forEach((path) => {
    fs.mkdirSync(path, { recursive: true });
  });
}
