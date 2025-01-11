/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection, Messages, SfError } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { Package2, Package2Member } from '../types/sfToolingApiTypes.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { GarbageFilter, PackageGarbageResult } from './packageGarbageTypes.js';
import { loadSupportedMetadataTypes, loadUnsupportedMetadataTypes } from './entity-handlers/index.js';
import { PACKAGE_2, PACKAGE_MEMBER_BASE, PACKAGE_MEMBER_QUERY } from './queries.js';
import ToolingApiConnection from './toolingApiConnection.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

export default class GarbageCollector extends EventEmitter {
  private toolingObjectsRunner: QueryRunner;
  private toolingApiCache: ToolingApiConnection;
  private devhubQueryRunner?: QueryRunner;

  public constructor(private targetOrgConnection: Connection, private devhubConnection?: Connection) {
    super();
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
    this.toolingApiCache = ToolingApiConnection.getInstance(this.targetOrgConnection);
    if (this.devhubConnection) {
      this.devhubQueryRunner = new QueryRunner(this.devhubConnection.tooling);
    }
  }

  //      PUBLIC STATIC

  public static newInstance(targetOrgConnection: Connection, devhubConnection?: Connection): GarbageCollector {
    return new GarbageCollector(targetOrgConnection, devhubConnection);
  }

  //      PUBLIC API

  public async export(filter?: GarbageFilter): Promise<PackageGarbageResult> {
    this.parseInputs(filter);
    const packageMembersContainer = await this.fetchPackageMembers(filter);
    await this.toolingApiCache.fetchEntityDefinitions(Object.keys(packageMembersContainer));
    const garbageContainer = await this.resolvePackageMembers(packageMembersContainer, filter);
    return garbageContainer;
  }

  //      PRIVATE ZONE

  private parseInputs(filter?: GarbageFilter): void {
    if (filter?.packages && filter.packages.length > 0 && !this.devhubConnection) {
      throw new SfError(
        'Packages filter specified, but no Devhub was provided.',
        'DevhubRequiredForPackages',
        ['Provide a valid DevHub, when you specify a packages filter.'],
        2
      );
    }
    if (filter?.packages && filter.packages.length > 0) {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: messages.getMessage('infos.packages-filter-active', [filter.packages.join(',')]),
      } as CommandStatusEvent);
    }
    if (filter?.includeOnly && filter.includeOnly.length > 0) {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: messages.getMessage('infos.metadata-filter-active', [filter.includeOnly.join(',')]),
      } as CommandStatusEvent);
    }
  }

  private async resolvePackageMembers(
    container: PackageMembersContainer,
    filter?: GarbageFilter
  ): Promise<PackageGarbageResult> {
    const supportedTypes = loadSupportedMetadataTypes(this.targetOrgConnection);
    const unsupportedTypes = loadUnsupportedMetadataTypes();
    const garbageContainer: PackageGarbageResult = {
      deprecatedMembers: {},
      ignoredTypes: {},
      notImplementedTypes: [],
      totalDeprecatedComponentCount: 0,
    };
    for (const keyPrefix of Object.keys(container)) {
      const entity = await this.toolingApiCache.getEntityDefinitionByKey(keyPrefix);
      if (entity === undefined) {
        continue;
      }
      const entityName = entity.QualifiedApiName;
      const packageMembers = container[keyPrefix];
      if (!isIncludedInFilter(entityName, filter)) {
        const reason = messages.getMessage('infos.excluded-from-result-not-in-filter');
        garbageContainer.ignoredTypes[entityName] = {
          reason,
          metadataType: entityName,
          componentCount: packageMembers.length,
        };
      } else if (supportedTypes[entityName] && isIncludedInFilter(entityName, filter)) {
        if (packageMembers.length > 0) {
          this.emitResolveStatus(`Resolving ${packageMembers.length} ${entityName}s (${keyPrefix})`);
        }
        const newMembers = await supportedTypes[entityName].resolve(packageMembers);
        garbageContainer.deprecatedMembers[entityName] = newMembers;
        garbageContainer.totalDeprecatedComponentCount += newMembers.componentCount;
        // in reality, Package2Member records may be corrupted and contain invalid SubjectIds
        // if numbers are not matching, debug some info to the user
        if (newMembers.componentCount !== packageMembers.length) {
          this.emitResolveStatus(`Package members resolved to ${newMembers.componentCount} actual ${entityName}(s).`);
        }
      } else if (unsupportedTypes[entityName]) {
        const unsupported = await unsupportedTypes[entityName].resolve(packageMembers);
        if (packageMembers.length > 0) {
          this.emitResolveStatus(
            `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}): ${unsupported.reason}`
          );
        }
        garbageContainer.ignoredTypes[entityName] = unsupported;
      } else if (keyPrefix.startsWith('m')) {
        if (packageMembers.length > 0) {
          this.emitResolveStatus(
            `Resolving ${packageMembers.length} ${entityName} (${keyPrefix}) as CustomMetadata records.`
          );
        }
        if (garbageContainer.deprecatedMembers['CustomMetadataRecord'] === undefined) {
          garbageContainer.deprecatedMembers['CustomMetadataRecord'] = {
            metadataType: 'CustomMetadata',
            componentCount: 0,
            components: [],
          };
        }
        const newRecords = (await supportedTypes['CustomMetadataRecord'].resolve(packageMembers)).components;
        garbageContainer.deprecatedMembers['CustomMetadataRecord'].components.push(...newRecords);
        garbageContainer.deprecatedMembers['CustomMetadataRecord'].componentCount += newRecords.length;
        garbageContainer.totalDeprecatedComponentCount += newRecords.length;
      } else {
        const reason = messages.getMessage('infos.not-yet-implemented');
        if (packageMembers.length > 0) {
          this.emitResolveStatus(
            `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}): ${reason}`
          );
        }
        garbageContainer.notImplementedTypes.push({ keyPrefix, entityName, memberCount: packageMembers.length });
      }
    }
    return garbageContainer;
  }

  private async fetchPackageMembers(filter?: GarbageFilter): Promise<PackageMembersContainer> {
    let subscriberPgkIds: string[];
    if (filter?.packages && filter.packages.length > 0) {
      subscriberPgkIds = await this.fetchSubscriberPackageVersions(filter.packages);
    }
    const packageMembers = await this.toolingObjectsRunner.fetchRecords<Package2Member>(PACKAGE_MEMBER_QUERY);
    packageMembers.push(...(await this.buildFlowPackageMembers()));
    const container: PackageMembersContainer = {};
    packageMembers.forEach((member) => {
      if (container[member.SubjectKeyPrefix] === undefined) {
        container[member.SubjectKeyPrefix] = new Array<Package2Member>();
      }
      // subscriber id cannot be filtered in SOQL, therefore we have to remove manually
      if (memberIsIncludedInPackageFilter(member, subscriberPgkIds)) {
        container[member.SubjectKeyPrefix].push(member);
      }
    });
    return container;
  }

  private async buildFlowPackageMembers(): Promise<Package2Member[]> {
    const packagedFlowDefinitions = await this.toolingObjectsRunner.fetchRecords<Package2Member>(
      QueryBuilder.sanitise(`${PACKAGE_MEMBER_BASE} WHERE SubjectKeyPrefix = '300'`)
    );
    const packageMembers: Package2Member[] = [];
    packagedFlowDefinitions.forEach((flowDefMember) => {
      packageMembers.push(flowDefMember);
    });
    return packageMembers;
  }

  private async fetchSubscriberPackageVersions(packageIds: string[]): Promise<string[]> {
    const package2s = await this.devhubQueryRunner!.fetchRecords<Package2>(
      `${PACKAGE_2} WHERE ${QueryBuilder.buildParamListFilter('Id', packageIds)}`
    );
    const subscriberPackageIds: string[] = [];
    package2s.forEach((p2) => {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: `Resolved ${p2.Id} (Package2) to ${p2.SubscriberPackageId} (SubscriberPackage)`,
      } as CommandStatusEvent);
      subscriberPackageIds.push(p2.SubscriberPackageId);
    });
    return subscriberPackageIds;
  }

  private emitResolveStatus(message: string): void {
    this.emit('resolveMemberStatus', {
      status: ProcessingStatus.InProgress,
      message,
    } as CommandStatusEvent);
  }
}

function isIncludedInFilter(entityName: string, filter?: GarbageFilter): boolean {
  const lowerCaseInclude = filter?.includeOnly?.map((str) => str.toLowerCase());
  return lowerCaseInclude?.includes(entityName.toLowerCase()) ?? filter?.includeOnly === undefined;
}

function memberIsIncludedInPackageFilter(member: Package2Member, subscriberPgkIds?: string[]): boolean {
  if (!subscriberPgkIds || subscriberPgkIds.length === 0) {
    return true;
  }
  const subscriberPgkId =
    member.MaxPackageVersion?.SubscriberPackageId ?? member.CurrentPackageVersion?.SubscriberPackageId;
  if (subscriberPgkId === undefined) {
    return false;
  }
  return subscriberPgkIds.includes(subscriberPgkId);
}

type PackageMembersContainer = {
  [x: string]: Package2Member[];
};
