import { XMLBuilder } from 'fast-xml-parser';
import { PackageGarbageResult } from './packageGarbage.js';
import { PackageManifestObject, XML_NS_KEY, XML_NS_URL } from './packageManifestTypes.js';

export default class PackageXmlBuilder {
  public static parseGarbageResultToXml(input: PackageGarbageResult): Promise<string> {
    const builder = new XMLBuilder({
      format: true,
      indentBy: ''.padEnd(4, ' '),
      ignoreAttributes: false,
    });
    const packageXml: PackageManifestObject = { Package: { types: [], version: '62.0' } };
    Object.keys(input.deprecatedMembers).forEach((key) => {
      const packageMembers = { members: new Array<string>(), name: input.deprecatedMembers[key].metadataType };
      input.deprecatedMembers[key].components.forEach((cmp) => {
        packageMembers.members.push(cmp.fullyQualifiedName);
      });
      if (packageMembers.members.length > 0) {
        packageXml.Package.types.push(packageMembers);
      }
    });
    packageXml.Package[XML_NS_KEY] = XML_NS_URL;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return builder.build(packageXml);
  }
}
