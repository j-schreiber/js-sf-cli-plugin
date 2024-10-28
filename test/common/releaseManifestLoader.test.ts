import fs from 'node:fs';
import { expect } from 'chai';
import { ZodError } from 'zod';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';

// exhaustive list of all "valid" source paths that are used in test manifests
const testSourcePaths = [
  'test/data/mock-src/package-overrides/core-crm/dev',
  'test/data/mock-src/package-overrides/core-crm/prod',
  'test/data/mock-src/package-overrides/pims',
  'test/data/mock-src/package-extensions/core-crm',
  'test/data/mock-src/unpackaged/org-shape',
  'test/data/mock-src/unpackaged/qa',
  'test/data/mock-src/unpackaged/prod-only',
  'test/data/mock-src/unpackaged/my-happy-soup',
];

describe('release manifest loader', () => {
  beforeEach(async () => {
    testSourcePaths.forEach((path) => {
      fs.mkdirSync(path, { recursive: true });
    });
  });

  afterEach(async () => {
    fs.rmSync('test/data/mock-src', { recursive: true });
  });

  it('parse complex manifest > loads successfully', () => {
    // Arrange
    const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');

    // Assert
    expect(orgManifest.data.environments).to.deep.equal({
      dev: 'admin-salesforce@mobilityhouse.com.dev',
      qa: 'admin@example.com.qa',
      prod: 'admin@example.com',
    });
    expect(orgManifest.getEnvironmentName('admin@example.com.qa')).to.equal('qa');
    expect(orgManifest.getEnvironmentName('admin-salesforce@mobilityhouse.com.dev')).to.equal('dev');
    expect(orgManifest.getEnvironmentName('unknown@example.com')).to.be.undefined;
    expect(orgManifest.getEnvironmentName('')).to.be.undefined;
    const artifactsMap = new Map(Object.entries(orgManifest.data.artifacts));
    expect(Array.from(artifactsMap.keys())).to.deep.equal([
      'org_shape_settings',
      'apex_utils',
      'lwc_utils',
      'core_crm',
      'core_crm_overrides',
      'core_crm_extensions',
      'pims',
      'pims_overrides',
    ]);
  });

  it('parse minimal manifest > loads successfully', () => {
    // Arrange
    const orgManifest = ReleaseManifestLoader.load('test/data/manifests/minimal.yaml');

    // Assert
    expect(orgManifest.data.environments).is.undefined;
    expect(orgManifest.getEnvironmentName('admin@example.com.qa')).to.be.undefined;
    const artifactsMap = new Map(Object.entries(orgManifest.data.artifacts));
    expect(Array.from(artifactsMap.keys())).to.deep.equal(['basic_happy_soup']);
  });

  it('loads manifest with simple path-directory does not exist > throws error', () => {
    // Arrange
    fs.rmdirSync('test/data/mock-src/unpackaged/my-happy-soup');

    // Assert
    expect(() => ReleaseManifestLoader.load('test/data/manifests/minimal.yaml')).to.throw(
      'Error parsing artifact "basic_happy_soup": test/data/mock-src/unpackaged/my-happy-soup does not exist.'
    );
  });

  it('loads manifest with complex path-directory does not exist > throws error', () => {
    // Arrange
    fs.rmdirSync('test/data/mock-src/package-overrides/pims');

    // Assert
    expect(() => ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml')).to.throw(
      'Error parsing artifact "pims_overrides": test/data/mock-src/package-overrides/pims does not exist.'
    );
  });

  it('loads manifest with missing environments > throws exception', () => {
    expect(() => ReleaseManifestLoader.load('test/data/manifests/invalid-path-no-envs.yaml')).to.throw(
      'Error parsing artifact "basic_happy_soup": "staging" is not defined in environments.'
    );
  });

  it('loads invalid manifest with missing required props > throws error', () => {
    // Act
    try {
      ReleaseManifestLoader.load('test/data/manifests/invalid.yaml');
      expect.fail('Should throw error, but succeeded');
    } catch (ze) {
      if (ze instanceof ZodError) {
        expect(ze.issues.length).to.equal(2, `${ze.toString()}`);
        expect(ze.issues[0].code).to.equal('invalid_type');
        expect(ze.issues[0].message).to.equal('At least one artifact is required');
        expect(ze.issues[1].code).to.equal('unrecognized_keys');
        expect(ze.issues[1].message).to.contain('not_artifacts_key');
      } else {
        expect.fail('Expected zod parsing error');
      }
    }
  });

  it('has invalid path file does not exist > throws error', () => {
    // Act
    expect(() => ReleaseManifestLoader.load('test/data/manifests/does-not-exist.yaml')).to.throw(
      'Invalid path, file does not exist: test/data/manifests/does-not-exist.yaml'
    );
  });
});

describe('release manifest', () => {
  it('test', () => {});
});
