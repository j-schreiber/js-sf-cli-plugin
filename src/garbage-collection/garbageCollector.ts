/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { FlowVersionDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import { PackageGarbage, PackageGarbageContainer, PackageGarbageResult } from './packageGarbage.js';
import { loadHandlers } from './entity-handlers/index.js';
import { OBSOLETE_FLOWS, PACKAGE_MEMBER_QUERY } from './queries/queries.js';
import ToolingApiConnection from './toolingApiConnection.js';

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

  public async export(): Promise<PackageGarbageResult> {
    const packageMembersContainer = await this.fetchPackageMembers();
    await this.toolingApiCache.fetchEntityDefinitions(Object.keys(packageMembersContainer));
    const garbageContainer = await this.resolvePackageMembers(packageMembersContainer);
    const outdatedFlows = await this.fetchOutdatedFlowVersions();
    if (outdatedFlows.componentCount > 0) {
      garbageContainer.deprecatedMembers['Flow'] = outdatedFlows;
    }
    return garbageContainer;
  }

  //      PRIVATE ZONE

  private async resolvePackageMembers(container: PackageMembersContainer): Promise<PackageGarbageResult> {
    const handlers = loadHandlers(this.targetOrgConnection);
    const garbageContainer: PackageGarbageResult = { deprecatedMembers: {}, unsupportedTypes: {}, unknownTypes: [] };
    for (const keyPrefix of Object.keys(container)) {
      const entity = await this.toolingApiCache.getEntityDefinitionByKey(keyPrefix);
      if (entity === undefined) {
        continue;
      }
      const entityName = entity.QualifiedApiName;
      const packageMembers = container[keyPrefix];
      if (handlers.supported[entityName]) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Resolving ${packageMembers.length} members for ${entityName} (${keyPrefix})`,
        } as CommandStatusEvent);
        garbageContainer.deprecatedMembers[entityName] = await handlers.supported[entityName].resolve(packageMembers);
      } else if (handlers.unsupported[entityName]) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}), metadata not supported by tooling API.`,
        } as CommandStatusEvent);
        garbageContainer.unsupportedTypes[entityName] = await handlers.unsupported[entityName].resolve(packageMembers);
      } else {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName} (${keyPrefix}), no handler registered.`,
        } as CommandStatusEvent);
        garbageContainer.unknownTypes.push({ keyPrefix, entityName, memberCount: packageMembers.length });
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

type PackageMembersContainer = {
  [x: string]: Package2Member[];
};
