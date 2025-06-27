import { expect } from 'chai';
import PackageManifestBuilder from '../../src/common/packageManifestBuilder.js';

const EMPTY_PACKAGE_XML = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>62.0</version>
</Package>
`;

const MULTI_TYPE_PACKAGE_XML = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <name>Flow</name>
        <members>Test_Flow-1</members>
    </types>
    <types>
        <name>CustomLabel</name>
        <members>Member_One</members>
        <members>Member_Two</members>
    </types>
    <version>64.0</version>
</Package>
`;

describe('package manifest builder', () => {
  it('builds empty XML with default params and no types added', () => {
    // Act
    const manifest = new PackageManifestBuilder();
    const xmlOutput = manifest.toXML();

    // Assert
    expect(xmlOutput).to.equal(EMPTY_PACKAGE_XML);
  });

  it('formats correct package XML from multiple types with members', () => {
    // Act
    const manifest = new PackageManifestBuilder('64.0');
    manifest.addMember('Flow', 'Test_Flow-1');
    manifest.addMember('CustomLabel', 'Member_One');
    manifest.addMember('CustomLabel', 'Member_Two');
    const xmlOutput = manifest.toXML();

    // Assert
    expect(xmlOutput).to.equal(MULTI_TYPE_PACKAGE_XML);
  });
});
