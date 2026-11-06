import fs from 'node:fs';
import path from 'node:path';
import PackageManifestBuilder from './packageManifestBuilder.js';
import { OutputFormats } from './jscSfCommandFlags.js';

/**
 * Initialise a manifest directory at the path. The directory writes
 * manifest XMLs (package.xml and destructiveChanges.xml) when closed.
 * Optionally pass the contents, otherwise the directory starts empty.
 */
export default class PackageManifestDirectory {
  private packageXml: PackageManifestBuilder;
  private destructiveChangesXml?: PackageManifestBuilder;

  public constructor(
    public readonly directoryPath: string,
    public readonly outputFormat?: OutputFormats,
    contents?: PackageManifestBuilder
  ) {
    fs.mkdirSync(this.directoryPath, { recursive: true });
    if (this.outputFormat === OutputFormats.DestructiveChangesXML) {
      this.packageXml = new PackageManifestBuilder();
      this.destructiveChangesXml = contents ?? new PackageManifestBuilder();
    } else {
      this.packageXml = contents ?? new PackageManifestBuilder();
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
      this.destructiveChangesXml!.writeToXmlFile(path.join(this.directoryPath, 'destructiveChanges.xml'));
    } else {
      fs.rmSync(path.join(this.directoryPath, 'destructiveChanges.xml'), { force: true });
    }
    this.packageXml.writeToXmlFile(path.join(this.directoryPath, 'package.xml'));
  }
}
