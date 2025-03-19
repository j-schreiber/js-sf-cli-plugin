import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition } from '../types/sfToolingApiTypes.js';
import { ALL_CUSTOM_OBJECTS } from './queries.js';

/**
 * Caches all custom objects from org and allows to retrieve & resolve by
 * Durable Id, key Prefix, etc.
 */
export default class CustomObjects {
  private readonly toolingObjectsRunner: QueryRunner;
  private readonly objectsByKey = new Map<string, EntityDefinition>();
  private readonly objectsByDurableId = new Map<string, EntityDefinition>();
  private readonly objectsByDeveloperName = new Map<string, EntityDefinition>();
  private readonly objectsByApiName = new Map<string, EntityDefinition>();
  private isInitialised = false;

  public constructor(private readonly targetOrgConnection: Connection) {
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
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
