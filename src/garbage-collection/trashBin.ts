/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection, Messages } from '@salesforce/core';
import { EntityDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import { loadSupportedMetadataTypes } from './entity-handlers/index.js';
import { PackageGarbageContainer, PackageGarbageResult, UnsupportedGarbageContainer } from './packageGarbageTypes.js';
import ToolingApiConnection from './toolingApiConnection.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

/**
 * Container to collect and store all garbage that is found on an org.
 */
export default class TrashBin extends EventEmitter {
  public deprecatedMembers: { [x: string]: PackageGarbageContainer };
  public unsupported: UnsupportedGarbageContainer[];
  private readonly supportedTypes;
  private readonly toolingApiCache: ToolingApiConnection;

  /**
   * All unsupported types can be added here. State an explicit reason
   * why this metadata can't be processed by garbage collection.
   */
  private readonly unsupportedTypes: { [x: string]: string } = {
    ListView: messages.getMessage('deprecated-list-views-not-accessible'),
    RecordType: messages.getMessage('record-types-cannot-be-deleted'),
  };

  public constructor(private readonly targetOrgConnection: Connection) {
    super();
    this.deprecatedMembers = {};
    this.unsupported = [];
    this.supportedTypes = loadSupportedMetadataTypes(this.targetOrgConnection);
    this.toolingApiCache = ToolingApiConnection.getInstance(this.targetOrgConnection);
  }

  /**
   * Accepts an unsorted/unorganized list of `Package2Member` and resolves their
   * deprecated components. Ignores unknown entities or key prefixes.
   *
   * @param unstructuredMembers
   */
  public async pushPackageMembers(unstructuredMembers: Package2Member[]): Promise<void> {
    const organizedMembers = organizeMembersByPrefix(unstructuredMembers);
    const entities = await this.toolingApiCache.fetchEntityDefinitions(Object.keys(organizedMembers));
    for (const [keyPrefix, members] of Object.entries(organizedMembers)) {
      const entity = entities.get(keyPrefix);
      if (entity && keyPrefix.startsWith('m')) {
        await this.resolveCustomMetadataTypeMembers(entity, members);
      } else if (entity && this.supportedTypes[entity.QualifiedApiName] !== undefined) {
        await this.resolveStandardEntity(entity, members);
      } else {
        this.resolveUnsupportedPackageMembers(keyPrefix, members, entity);
      }
    }
  }

  /**
   * Formats all package member garbage for output.
   *
   * @returns
   */
  public format(): PackageGarbageResult {
    return {
      deprecatedMembers: this.deprecatedMembers,
      totalDeprecatedComponentCount: Object.values(this.deprecatedMembers).reduce(
        (accumulator, currentValue) => accumulator + currentValue.componentCount,
        0
      ),
      unsupported: this.unsupported,
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

  private resolveUnsupportedPackageMembers(
    keyPrefix: string,
    members: Package2Member[],
    entity?: EntityDefinition
  ): void {
    const entityName = entity?.QualifiedApiName;
    let reason;
    if (entityName && this.unsupportedTypes[entityName]) {
      reason = messages.getMessage('infos.not-fully-supported-by-tooling-api', [
        entityName,
        keyPrefix,
        this.unsupportedTypes[entityName],
        members.length,
      ]);
    } else if (entityName) {
      reason = messages.getMessage('infos.not-yet-implemented', [entityName, keyPrefix, members.length]);
    } else {
      reason = messages.getMessage('infos.unknown-keyprefix', [keyPrefix, members.length]);
    }
    this.emit('resolve', { message: reason });
    this.unsupported.push({
      keyPrefix,
      entityName,
      componentCount: members.length,
      reason,
    });
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
