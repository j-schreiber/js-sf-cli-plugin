import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition, FieldDefinition, QuickActionDefinitionType } from '../types/sfToolingApiTypes.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { ALL_CUSTOM_OBJECTS, ENTITY_DEFINITION_QUERY } from './queries.js';

/**
 * Caches all custom objects from org and allows to retrieve & resolve by
 * Durable Id, key Prefix, etc.
 */
export default class ToolingApiConnection {
  private static activeConnection: ToolingApiConnection;

  private toolingObjectsRunner: QueryRunner;
  private objectsByKey = new Map<string, EntityDefinition>();
  private objectsByDurableId = new Map<string, EntityDefinition>();
  private objectsByDeveloperName = new Map<string, EntityDefinition>();
  private objectsByApiName = new Map<string, EntityDefinition>();
  private isInitialised = false;
  private allEntityDefinitionsByKey = new Map<string, EntityDefinition>();
  private customFieldsBySubjectId = new Map<string, FieldDefinition>();
  private quickActionsBySubjectId = new Map<string, QuickActionDefinitionType>();

  private constructor(private targetOrgConnection: Connection) {
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

  /**
   * Fetches all quick action definitions for a list of subject ids and returns them
   * mapped by their subject ids.
   *
   * @param subjectIds
   */
  public async fetchQuickActions(subjectIds: string[]): Promise<Map<string, QuickActionDefinitionType>> {
    if (this.quickActionsBySubjectId.size === 0) {
      const actionDefs = await this.toolingObjectsRunner.fetchRecords<QuickActionDefinitionType>(
        `SELECT Id,DeveloperName,EntityDefinitionId,EntityDefinition.QualifiedApiName,SobjectType FROM QuickActionDefinition WHERE ${QueryBuilder.buildParamListFilter(
          'Id',
          subjectIds
        )}`
      );
      actionDefs.forEach((actionDef) => {
        this.quickActionsBySubjectId.set(actionDef.Id, actionDef);
      });
    }
    return this.quickActionsBySubjectId;
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
