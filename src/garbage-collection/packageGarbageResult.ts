import { Connection } from '@salesforce/core';
import { Package2Member } from '../types/sfToolingApiTypes.js';
import { loadSupportedMetadataTypes, loadUnsupportedMetadataTypes } from './entity-handlers/index.js';
import { IgnoredPackageGarbageContainer, PackageGarbageContainer, UnknownEntityPrefix } from './packageGarbageTypes.js';

export default class PackageGarbageResult {
  public deprecatedMembers: { [x: string]: PackageGarbageContainer };
  public ignoredTypes: { [x: string]: IgnoredPackageGarbageContainer };
  public notImplementedTypes: UnknownEntityPrefix[];
  public totalDeprecatedComponentCount: number = 0;
  private readonly unsupportedTypes = loadUnsupportedMetadataTypes();
  private readonly supportedTypes;

  public constructor(private readonly targetOrgConnection: Connection) {
    this.deprecatedMembers = {};
    this.ignoredTypes = {};
    this.notImplementedTypes = [];
    this.supportedTypes = loadSupportedMetadataTypes(this.targetOrgConnection);
  }

  public async pushCustomMetadataRecords(members: Package2Member[]): Promise<void> {
    if (this.deprecatedMembers['CustomMetadataRecord'] === undefined) {
      this.deprecatedMembers['CustomMetadataRecord'] = {
        metadataType: 'CustomMetadata',
        componentCount: 0,
        components: [],
      };
    }
    const newRecords = (await this.supportedTypes['CustomMetadataRecord'].resolve(members)).components;
    this.deprecatedMembers['CustomMetadataRecord'].components.push(...newRecords);
    this.deprecatedMembers['CustomMetadataRecord'].componentCount += newRecords.length;
    this.totalDeprecatedComponentCount += newRecords.length;
  }
}
