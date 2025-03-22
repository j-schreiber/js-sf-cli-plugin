import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition, FieldDefinition, SubscriberPackage } from '../types/sfToolingApiTypes.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { ALL_CUSTOM_OBJECTS, ENTITY_DEFINITION_QUERY, SUBSCRIBER_PACKAGE_FIELDS } from './queries.js';

/**
 * Caches all custom objects from org and allows to retrieve & resolve by
 * Durable Id, key Prefix, etc.
 */
export default class ToolingApiConnection {
  private static activeConnection: ToolingApiConnection;

  private readonly toolingObjectsRunner: QueryRunner;
  private readonly objectsByKey = new Map<string, EntityDefinition>();
  private readonly objectsByDurableId = new Map<string, EntityDefinition>();
  private readonly objectsByDeveloperName = new Map<string, EntityDefinition>();
  private readonly objectsByApiName = new Map<string, EntityDefinition>();
  private readonly allEntityDefinitionsByKey = new Map<string, EntityDefinition>();
  private readonly customFieldsBySubjectId = new Map<string, FieldDefinition>();
  private readonly subscriberPackages = new Map<string, SubscriberPackage | undefined>();
  private isInitialised = false;

  public constructor(private readonly targetOrgConnection: Connection) {
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
  }

  /**
   * An active connection that caches queries to share accross the app
   *
   * @param targetOrgConnection
   * @returns
   */
  public static getInstance(targetOrgConnection: Connection): ToolingApiConnection {
    if (!ToolingApiConnection.activeConnection) {
      ToolingApiConnection.activeConnection = new ToolingApiConnection(targetOrgConnection);
    }
    return ToolingApiConnection.activeConnection;
  }

  public async resolveKeyPrefix(keyPrefix: string): Promise<EntityDefinition | undefined> {
    if (!this.isInitialised) {
      await this.loadObjects();
    }
    return this.objectsByKey.get(keyPrefix);
  }

  public async resolve18CharDurableId(objectId: string): Promise<EntityDefinition | undefined> {
    if (!this.isInitialised) {
      await this.loadObjects();
    }
    return this.objectsByDurableId.get(objectId.substring(0, 15));
  }

  public async fetchObjectDefinitionsByDurableId(): Promise<Map<string, EntityDefinition>> {
    if (!this.isInitialised) {
      await this.loadObjects();
    }
    return this.objectsByDurableId;
  }

  public async fetchObjectDefinitionsByKeyPrefix(): Promise<Map<string, EntityDefinition>> {
    if (!this.isInitialised) {
      await this.loadObjects();
    }
    return this.objectsByKey;
  }

  /**
   * Resolves a potentially invalid list of subscriber package ids in null/undefined safe way
   * to a map of subscriber packages (by their id). All invalid ids are ignored.
   *
   * @param subscriberPackageIds
   * @returns
   */
  public async resolveSubscriberPackageIds(subscriberPackageIds: string[]): Promise<Map<string, SubscriberPackage>> {
    const subPackagePromises = new Array<Promise<SubscriberPackage | undefined>>();
    subscriberPackageIds.forEach((id) => subPackagePromises.push(this.resolveSubscriberPackageId(id)));
    const subpackages = await Promise.all(subPackagePromises);
    const resolvedIds = new Map<string, SubscriberPackage>();
    subpackages.forEach((potentialPackage) => {
      if (potentialPackage) {
        resolvedIds.set(potentialPackage.Id, potentialPackage);
      }
    });
    return resolvedIds;
  }

  public async resolveSubscriberPackageId(subscriberPackageId: string): Promise<SubscriberPackage | undefined> {
    if (subscriberPackageId === undefined || subscriberPackageId === null || subscriberPackageId.length === 0) {
      return;
    }
    if (this.subscriberPackages.has(subscriberPackageId)) {
      return this.subscriberPackages.get(subscriberPackageId);
    }
    const pkgs = await this.toolingObjectsRunner.fetchRecords<SubscriberPackage>(
      `SELECT ${SUBSCRIBER_PACKAGE_FIELDS.join(',')} FROM SubscriberPackage WHERE Id = '${subscriberPackageId}'`
    );
    if (pkgs.length >= 1) {
      this.subscriberPackages.set(subscriberPackageId, pkgs[0]);
    } else {
      this.subscriberPackages.set(subscriberPackageId, undefined);
    }
    return this.subscriberPackages.get(subscriberPackageId);
  }

  /**
   * Returns a entity definition by key prefix and caches the result.
   *
   * @param keyPrefix
   * @returns
   */
  public async getEntityDefinitionByKey(keyPrefix: string): Promise<EntityDefinition | undefined> {
    if (!this.allEntityDefinitionsByKey.has(keyPrefix)) {
      await this.fetchEntityDefinitions([keyPrefix]);
    }
    return this.allEntityDefinitionsByKey.get(keyPrefix);
  }

  /**
   * Fetches entity definitions for a list of key prefixes
   *
   * @param keyPrefixes
   * @returns
   */
  public async fetchEntityDefinitions(keyPrefixes: string[]): Promise<Map<string, EntityDefinition>> {
    if (this.allEntityDefinitionsByKey.size === 0) {
      const entityDefinitions = await this.toolingObjectsRunner.fetchRecords<EntityDefinition>(
        `${ENTITY_DEFINITION_QUERY} WHERE ${QueryBuilder.buildParamListFilter('KeyPrefix', keyPrefixes)}`
      );
      entityDefinitions.forEach((entityDef) => this.allEntityDefinitionsByKey.set(entityDef.KeyPrefix, entityDef));
    }
    return this.allEntityDefinitionsByKey;
  }

  /**
   * Returns all entity definitions by "QualifiedApiName"
   *
   * @param qualifiedApiNames
   * @returns
   */
  public async resolveEntityDefinitionNames(qualifiedApiNames?: string[]): Promise<EntityDefinition[]> {
    if (!qualifiedApiNames || qualifiedApiNames.length === 0) {
      return [];
    }
    const entityDefinitions = await this.toolingObjectsRunner.fetchRecords<EntityDefinition>(
      `${ENTITY_DEFINITION_QUERY} WHERE ${QueryBuilder.buildParamListFilter('QualifiedApiName', qualifiedApiNames)}`
    );
    return entityDefinitions;
  }

  /**
   * Fetches all custom fields for a list of subject ids and returns them
   * mapped by their subject ids.
   *
   * @param subjectIds
   */
  public async fetchCustomFields(subjectIds: string[]): Promise<Map<string, FieldDefinition>> {
    if (this.customFieldsBySubjectId.size === 0) {
      const customFieldDefinitions = await this.toolingObjectsRunner.fetchRecords<FieldDefinition>(
        `SELECT Id,DeveloperName,TableEnumOrId FROM CustomField WHERE ${QueryBuilder.buildParamListFilter(
          'Id',
          subjectIds
        )}`
      );
      customFieldDefinitions.forEach((fieldDef) => {
        this.customFieldsBySubjectId.set(fieldDef.Id, fieldDef);
      });
    }
    return this.customFieldsBySubjectId;
  }

  private async loadObjects(): Promise<void> {
    const entityDefinitions = await this.toolingObjectsRunner.fetchRecords<EntityDefinition>(ALL_CUSTOM_OBJECTS);
    entityDefinitions.forEach((entityDef) => {
      this.objectsByKey.set(entityDef.KeyPrefix, entityDef);
      this.objectsByDeveloperName.set(entityDef.DeveloperName, entityDef);
      this.objectsByApiName.set(entityDef.QualifiedApiName, entityDef);
      this.objectsByDurableId.set(entityDef.DurableId, entityDef);
    });
    this.isInitialised = true;
  }
}

export type EntitiesMap = {
  [x: string]: EntityDefinition;
};
