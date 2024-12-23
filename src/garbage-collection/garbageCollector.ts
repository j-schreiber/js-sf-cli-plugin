/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection, Messages } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { FlowVersionDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import { GarbageFilter, PackageGarbage, PackageGarbageContainer, PackageGarbageResult } from './packageGarbage.js';
import { loadSupportedMetadataTypes, loadUnsupportedMetadataTypes } from './entity-handlers/index.js';
import { OBSOLETE_FLOWS, PACKAGE_MEMBER_QUERY } from './queries.js';
import ToolingApiConnection from './toolingApiConnection.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

export default class GarbageCollector extends EventEmitter {
  private toolingObjectsRunner: QueryRunner;
  private toolingApiCache: ToolingApiConnection;

  public constructor(private targetOrgConnection: Connection) {
    super();
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
    this.toolingApiCache = ToolingApiConnection.getInstance(this.targetOrgConnection);
  }

  //      PUBLIC STATIC

  public static newInstance(targetOrgConnection: Connection): GarbageCollector {
    return new GarbageCollector(targetOrgConnection);
  }

  //      PUBLIC API

  public async export(filter?: GarbageFilter): Promise<PackageGarbageResult> {
    const packageMembersContainer = await this.fetchPackageMembers();
    await this.toolingApiCache.fetchEntityDefinitions(Object.keys(packageMembersContainer));
    const garbageContainer = await this.resolvePackageMembers(packageMembersContainer, filter);
    if (filter?.includeOnly?.includes('Flow') ?? filter?.includeOnly === undefined) {
      const outdatedFlows = await this.fetchOutdatedFlowVersions();
      if (outdatedFlows.componentCount > 0) {
        garbageContainer.deprecatedMembers['Flow'] = outdatedFlows;
      }
    }
    return garbageContainer;
  }

  //      PRIVATE ZONE

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
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Resolving ${packageMembers.length} ${entityName}s (${keyPrefix})`,
        } as CommandStatusEvent);
        garbageContainer.deprecatedMembers[entityName] = await supportedTypes[entityName].resolve(packageMembers);
      } else if (unsupportedTypes[entityName]) {
        const unsupported = await unsupportedTypes[entityName].resolve(packageMembers);
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}): ${unsupported.reason}`,
        } as CommandStatusEvent);
        garbageContainer.ignoredTypes[entityName] = unsupported;
      } else if (keyPrefix.startsWith('m')) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Resolving ${packageMembers.length} ${entityName} (${keyPrefix}) as CustomMetadata records.`,
        } as CommandStatusEvent);
        if (garbageContainer.deprecatedMembers['CustomMetadataRecord'] === undefined) {
          garbageContainer.deprecatedMembers['CustomMetadataRecord'] = {
            metadataType: 'CustomMetadata',
            componentCount: 0,
            components: [],
          };
        }
        garbageContainer.deprecatedMembers['CustomMetadataRecord'].components.push(
          ...(await supportedTypes['CustomMetadataRecord'].resolve(packageMembers)).components
        );
        garbageContainer.deprecatedMembers['CustomMetadataRecord'].componentCount =
          garbageContainer.deprecatedMembers['CustomMetadataRecord'].components.length;
      } else {
        const reason = messages.getMessage('infos.not-yet-implemented');
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}): ${reason}`,
        } as CommandStatusEvent);
        garbageContainer.notImplementedTypes.push({ keyPrefix, entityName, memberCount: packageMembers.length });
      }
    }
    return garbageContainer;
  }

  private async fetchPackageMembers(): Promise<PackageMembersContainer> {
    const packageMembers = await this.toolingObjectsRunner.fetchRecords<Package2Member>(PACKAGE_MEMBER_QUERY);
    const container: PackageMembersContainer = {};
    packageMembers.forEach((member) => {
      if (container[member.SubjectKeyPrefix] === undefined) {
        container[member.SubjectKeyPrefix] = new Array<Package2Member>();
      }
      container[member.SubjectKeyPrefix].push(member);
    });
    return container;
  }

  private async fetchOutdatedFlowVersions(): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const outdatedVersions = await this.toolingObjectsRunner.fetchRecords<FlowVersionDefinition>(OBSOLETE_FLOWS);
    outdatedVersions.forEach((flowVersion) => {
      garbageList.push({
        developerName: `${flowVersion.Definition.DeveloperName}-${flowVersion.VersionNumber}`,
        fullyQualifiedName: `${flowVersion.Definition.DeveloperName}-${flowVersion.VersionNumber}`,
        subjectId: flowVersion.Id,
      });
    });
    return { metadataType: 'Flow', componentCount: garbageList.length, components: garbageList };
  }
}

function isIncludedInFilter(entityName: string, filter?: GarbageFilter): boolean {
  const lowerCaseInclude = filter?.includeOnly?.map((str) => str.toLowerCase());
  return lowerCaseInclude?.includes(entityName.toLowerCase()) ?? filter?.includeOnly === undefined;
}

type PackageMembersContainer = {
  [x: string]: Package2Member[];
};
