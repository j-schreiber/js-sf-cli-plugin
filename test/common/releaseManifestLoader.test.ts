import { expect } from 'chai';
import { ZodError } from 'zod';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';

describe('release manifest loader', () => {
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
