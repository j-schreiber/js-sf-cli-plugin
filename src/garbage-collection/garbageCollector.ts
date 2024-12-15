/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import { PackageGarbageResult } from './packageGarbage.js';
import { loadHandlers } from './entity-handlers/index.js';
import { ENTITY_DEFINITION_QUERY, PACKAGE_MEMBER_QUERY } from './queries/queries.js';

export default class GarbageCollector extends EventEmitter {
  private toolingObjectsRunner: QueryRunner;
  // private sobjectsRunner: QueryRunner;

  public constructor(private targetOrgConnection: Connection) {
    super();
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
    // this.sobjectsRunner = new QueryRunner(this.targetOrgConnection);
  }

  //      PUBLIC API

  public async export(): Promise<PackageGarbageResult> {
    const packageMembersContainer = await this.fetchPackageMembers();
    const garbageContainer = await this.resolvePackageMembers(packageMembersContainer);
    return garbageContainer;
  }

  //      PRIVATE ZONE

  private async resolvePackageMembers(container: PackageMembersContainer): Promise<PackageGarbageResult> {
    const entitiesMap = await this.fetchEntityDefinitions(Object.keys(container));
    // load definition handlers
    const handlers = loadHandlers(this.targetOrgConnection);
    const garbageContainer: PackageGarbageResult = { deprecatedMembers: {}, unsupportedTypes: {}, unknownTypes: [] };
    for (const keyPrefix of Object.keys(container)) {
      const entityName = entitiesMap[keyPrefix].QualifiedApiName;
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

  private async fetchEntityDefinitions(keyPrefixes: string[]): Promise<EntitiesMap> {
    const entityDefinitions = await this.toolingObjectsRunner.fetchRecords<EntityDefinition>(
      `${ENTITY_DEFINITION_QUERY} WHERE ${QueryBuilder.buildParamListFilter('KeyPrefix', keyPrefixes)}`
    );
    const entitiesMap: EntitiesMap = {};
    entityDefinitions.forEach((entityDef) => (entitiesMap[entityDef.KeyPrefix] = entityDef));
    return entitiesMap;
  }
}

type PackageMembersContainer = {
  [x: string]: Package2Member[];
};

type EntitiesMap = {
  [x: string]: EntityDefinition;
};
