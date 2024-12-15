import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import { fileURLToPath } from 'node:url';
import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition, Package2Member } from '../types/sfToolingApiTypes.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import { PackageGarbageResult } from './packageGarbage.js';
import { loadHandlers } from './entity-handlers/index.js';

export default class GarbageCollector extends EventEmitter {
  public static PACKAGE_MEMBER_QUERY: string = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'queries', 'package2members.sql'),
    'utf8'
  );
  public static ENTITY_DEFINITION_QUERY: string = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'queries', 'entity-definitions.sql'),
    'utf8'
  );

  private toolingObjectsRunner: QueryRunner;
  // private sobjectsRunner: QueryRunner;

  public constructor(private targetOrgConnection: Connection) {
    super();
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
    // this.sobjectsRunner = new QueryRunner(this.targetOrgConnection);
  }

  public async export(): Promise<PackageGarbageResult> {
    // retrieve package2members & analyse key prefixes
    const packageMembersContainer = await this.fetchPackageMembers();
    const garbageContainer = await this.resolvePackageMembers(packageMembersContainer);
    return garbageContainer;
  }

  private async resolvePackageMembers(container: PackageMembersContainer): Promise<PackageGarbageResult> {
    const entitiesMap = await this.fetchEntityDefinitions(Object.keys(container));
    // load definition handlers
    const handlers = loadHandlers(this.targetOrgConnection);
    const garbageContainer: PackageGarbageResult = { deprecatedMembers: {}, unsupportedTypes: {}, unknownTypes: [] };
    for (const keyPrefix of Object.keys(container)) {
      const entityName = entitiesMap[keyPrefix].QualifiedApiName;
      if (keyPrefix.startsWith('m')) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Custom metadata ${entityName} with prefix ${keyPrefix} detected. Not yet supported`,
        } as CommandStatusEvent);
        continue;
      }
      if (keyPrefix.startsWith('e')) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Platform Event ${entityName} with prefix ${keyPrefix} detected. Not yet supported`,
        } as CommandStatusEvent);
        continue;
      }
      const packageMembers = container[keyPrefix];
      if (handlers.supported[entityName]) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Resolving ${packageMembers.length} members for ${entityName}`,
        } as CommandStatusEvent);
        // eslint-disable-next-line no-await-in-loop
        garbageContainer.deprecatedMembers[entityName] = await handlers.supported[entityName].resolve(packageMembers);
      } else if (handlers.unsupported[entityName]) {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName}, metadata currently not supported by tooling API.`,
        } as CommandStatusEvent);
        // eslint-disable-next-line no-await-in-loop
        garbageContainer.unsupportedTypes[entityName] = await handlers.unsupported[entityName].resolve(packageMembers);
      } else {
        this.emit('resolveMemberStatus', {
          status: ProcessingStatus.InProgress,
          message: `Skipping ${packageMembers.length} members for ${entityName} with prefix ${keyPrefix}, no handler registered.`,
        } as CommandStatusEvent);
        garbageContainer.unknownTypes.push({ keyPrefix, entityName });
      }
    }
    return garbageContainer;
  }

  private async fetchPackageMembers(): Promise<PackageMembersContainer> {
    const packageMembers = await this.toolingObjectsRunner.fetchRecords<Package2Member>(
      GarbageCollector.PACKAGE_MEMBER_QUERY
    );
    const container: PackageMembersContainer = {};
    packageMembers.forEach((member) => {
      if (container[member.SubjectKeyPrefix] === undefined) {
        container[member.SubjectKeyPrefix] = new Array<Package2Member>();
      }
      container[member.SubjectKeyPrefix].push(member);
    });
    // console.log(JSON.stringify(container, null, 2));
    return container;
  }

  private async fetchEntityDefinitions(keyPrefixes: string[]): Promise<EntitiesMap> {
    const entityDefinitions = await this.toolingObjectsRunner.fetchRecords<EntityDefinition>(
      `${GarbageCollector.ENTITY_DEFINITION_QUERY} WHERE ${QueryBuilder.buildParamListFilter('KeyPrefix', keyPrefixes)}`
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
