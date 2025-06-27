import fs from 'node:fs';
import PackageManifestBuilder from './packageManifestBuilder.js';
import { OutputFormats } from './jscSfCommandFlags.js';

/**
 * Initialise an empty manifest directory at the path. The directory
 * writes manifest XMLs (package.xml and destructiveChanges.xml) when
 * closed.
 */
export default class PackageManifestDirectory {
  private packageXml: PackageManifestBuilder;
  private destructiveChangesXml?: PackageManifestBuilder;

  public constructor(public readonly directoryPath: string, public readonly outputFormat?: OutputFormats) {
    fs.mkdirSync(this.directoryPath, { recursive: true });
    this.packageXml = new PackageManifestBuilder();
    if (this.outputFormat === OutputFormats.DestructiveChangesXML) {
      this.destructiveChangesXml = new PackageManifestBuilder();
    }
  }

  /**
   * Returns the primary builder that holds contents,
   * based on the output format.
   */
  public getBuilder(): PackageManifestBuilder {
    return this.outputFormat === OutputFormats.DestructiveChangesXML ? this.destructiveChangesXml! : this.packageXml;
  }

  /**
   * Writes all manifest files to output dir and clears
   * obsolete files if they exist.
   */
  public write(): void {
    if (this.outputFormat === OutputFormats.DestructiveChangesXML) {
      this.destructiveChangesXml!.writeToXmlFile(`${this.directoryPath}/destructiveChanges.xml`);
    } else {
      fs.rmSync(`${this.directoryPath}/destructiveChanges.xml`, { force: true });
    }
    this.packageXml.writeToXmlFile(`${this.directoryPath}/package.xml`);
  }
}
