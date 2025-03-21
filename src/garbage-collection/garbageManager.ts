/* eslint-disable no-await-in-loop */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../types/sfToolingApiTypes.js';
import { loadSupportedMetadataTypes } from './entity-handlers/index.js';
import { PackageGarbageContainer, PackageGarbageResult } from './packageGarbageTypes.js';
import ToolingApiConnection from './toolingApiConnection.js';

export default class GarbageManager {
  public deprecatedMembers: { [x: string]: PackageGarbageContainer };
  private readonly supportedTypes;
  private readonly toolingApiCache: ToolingApiConnection;

  public constructor(private readonly targetOrgConnection: Connection) {
    this.deprecatedMembers = {};
    this.supportedTypes = loadSupportedMetadataTypes(this.targetOrgConnection);
    this.toolingApiCache = ToolingApiConnection.getInstance(this.targetOrgConnection);
  }

  /**
   * Accepts an unsorted/unorganized list of `Package2Member` and resolves their
   * deprecated components. Unknown entities or key prefixes are silently ignored.
   *
   * @param unstructuredMembers
   */
  public async pushPackageMembers(unstructuredMembers: Package2Member[]): Promise<void> {
    const organizedMembers = organizeMembersByPrefix(unstructuredMembers);
    const entities = await this.toolingApiCache.fetchEntityDefinitions(Object.keys(organizedMembers));
    for (const [keyPrefix, members] of Object.entries(organizedMembers)) {
      if (keyPrefix.startsWith('m')) {
        await this.resolveCustomMetadataTypeMembers(members);
        continue;
      }
      const entity = entities.get(keyPrefix);
      if (entity === undefined || this.supportedTypes[entity.QualifiedApiName] === undefined) {
        continue;
      }
      this.deprecatedMembers[entity.QualifiedApiName] = await this.supportedTypes[entity.QualifiedApiName].resolve(
        members
      );
    }
  }

  /**
   *
   *
   * @returns
   */
  public format(): PackageGarbageResult {
    return {
      notImplementedTypes: [],
      ignoredTypes: {},
      deprecatedMembers: this.deprecatedMembers,
      totalDeprecatedComponentCount: Object.values(this.deprecatedMembers).reduce(
        (accumulator, currentValue) => accumulator + currentValue.componentCount,
        0
      ),
    };
  }

  //          PRIVATE ZONE

  private async resolveCustomMetadataTypeMembers(members: Package2Member[]): Promise<void> {
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
  }
}

function organizeMembersByPrefix(members: Package2Member[]): { [x: string]: Package2Member[] } {
  const organizedMembers: {
    [x: string]: Package2Member[];
  } = {};
  members.forEach((member) => {
    if (organizedMembers[member.SubjectKeyPrefix] === undefined) {
      organizedMembers[member.SubjectKeyPrefix] = [];
    }
    organizedMembers[member.SubjectKeyPrefix].push(member);
  });
  return organizedMembers;
}
