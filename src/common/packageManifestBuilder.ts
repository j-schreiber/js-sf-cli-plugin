import fs from 'node:fs';
import { XMLBuilder } from 'fast-xml-parser';

// copied from https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/common/constants.ts
// all credits to mshanemc
const XML_NS_URL = 'http://soap.sforce.com/2006/04/metadata';
const XML_NS_KEY = '@_xmlns';

export type PackageTypeMembers = {
  name: string;
  members: string[];
};

export type PackageManifest = {
  Package: {
    types: Record<string, PackageTypeMembers>;
    version: string;
  };
};

export default class PackageManifestBuilder {
  private types: Record<string, PackageTypeMembers>;

  public constructor(public apiVersion?: string) {
    this.types = {};
  }

  /**
   * Adds a new member to a type container. If the type does not exist yet,
   * the container is created.
   *
   * @param type
   * @param memberName
   */
  public addMember(type: string, memberName: string): void {
    if (this.types[type] === undefined) {
      this.types[type] = {
        name: type,
        members: [],
      };
    }
    this.types[type].members.push(memberName);
  }

  /**
   * Formats the current package manifest instance to XML string.
   *
   * @returns
   */
  public toXML(): string {
    const builder = new XMLBuilder({
      format: true,
      indentBy: ''.padEnd(4, ' '),
      ignoreAttributes: false,
    });
    return builder.build({
      Package: {
        types: Object.values(this.types),
        version: this.apiVersion ?? '62.0',
        [XML_NS_KEY]: XML_NS_URL,
      },
    });
  }

  /**
   * Writes the contents as XML to the destination path.
   *
   * @param path
   */
  public writeToXmlFile(path: string): void {
    fs.writeFileSync(path, this.toXML());
  }
}
