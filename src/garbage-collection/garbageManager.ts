/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection } from '@salesforce/core';
import { EntityDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import { loadSupportedMetadataTypes } from './entity-handlers/index.js';
import { PackageGarbageContainer, PackageGarbageResult } from './packageGarbageTypes.js';
import ToolingApiConnection from './toolingApiConnection.js';

export default class GarbageManager extends EventEmitter {
  public deprecatedMembers: { [x: string]: PackageGarbageContainer };
  private readonly supportedTypes;
  private readonly toolingApiCache: ToolingApiConnection;

  public constructor(private readonly targetOrgConnection: Connection) {
    super();
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
      const entity = entities.get(keyPrefix);
      if (entity === undefined) {
        continue;
      }
      if (keyPrefix.startsWith('m')) {
        await this.resolveCustomMetadataTypeMembers(entity, members);
      } else if (this.supportedTypes[entity.QualifiedApiName] !== undefined) {
        await this.resolveStandardEntity(entity, members);
      }
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

  private async resolveCustomMetadataTypeMembers(entity: EntityDefinition, members: Package2Member[]): Promise<void> {
    if (members.length > 0) {
      this.emit('resolve', {
        message: `Resolving ${members.length} ${entity.QualifiedApiName} (${entity.KeyPrefix}) as CustomMetadata records.`,
      });
    }
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

  private async resolveStandardEntity(entity: EntityDefinition, members: Package2Member[]): Promise<void> {
    if (members.length > 0) {
      this.emit('resolve', {
        message: `Resolving ${members.length} ${entity.QualifiedApiName}s (${entity.KeyPrefix})`,
      });
    }
    const newMembers = await this.supportedTypes[entity.QualifiedApiName].resolve(members);
    this.deprecatedMembers[entity.QualifiedApiName] = newMembers;
    if (newMembers.componentCount !== members.length) {
      this.emit('resolve', {
        message: `Package members resolved to ${newMembers.componentCount} actual ${entity.QualifiedApiName}(s).`,
      });
    }
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
