import { expect } from 'chai';
import ReleaseManifestLoader from '../../src/common/releaseManifestLoader.js';

describe('release manifest loader', () => {
  it('parse valid yaml > loads successfully', () => {
    // Arrange
    const orgManifest = ReleaseManifestLoader.loadManifest('test/data/manifests/test.yaml');

    // Assert
    expect(Object.keys(orgManifest.environments!).length).to.equal(3);
    expect(orgManifest.environments!.dev).to.equal('admin@example.com.dev');
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
});
