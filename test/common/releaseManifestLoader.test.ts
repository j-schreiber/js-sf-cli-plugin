import { expect } from 'chai';
import ReleaseManifestLoader from '../../src/release-manifest/releaseManifestLoader.js';

describe('release manifest loader', () => {
  it('parse complex manifest > loads successfully', () => {
    // Arrange
    const orgManifest = ReleaseManifestLoader.load('test/data/manifests/complex-with-envs.yaml');

    // Assert
    expect(Object.keys(orgManifest.environments!).length).to.equal(3);
    expect(orgManifest.environments!.dev).to.equal('admin-salesforce@mobilityhouse.com.dev');
    expect(orgManifest.environments!.qa).to.equal('admin@example.com.qa');
    expect(orgManifest.environments!.prod).to.equal('admin@example.com');
    const artifactsMap = new Map(Object.entries(orgManifest.artifacts));
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
    expect(orgManifest.environments).is.undefined;
    const artifactsMap = new Map(Object.entries(orgManifest.artifacts));
    expect(Array.from(artifactsMap.keys())).to.deep.equal(['basic_happy_soup']);
  });
});
