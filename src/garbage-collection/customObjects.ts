import { Connection } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition } from '../types/sfToolingApiTypes.js';
import { ALL_CUSTOM_OBJECTS } from './queries/queries.js';

/**
 * Caches all custom objects from org and allows to retrieve & resolve by
 * Durable Id, key Prefix, etc.
 */
export default class CustomObjects {
  private toolingObjectsRunner: QueryRunner;
  private objectsByKey = new Map<string, EntityDefinition>();
  private objectsByDurableId = new Map<string, EntityDefinition>();
  private objectsByDeveloperName = new Map<string, EntityDefinition>();
  private objectsByApiName = new Map<string, EntityDefinition>();
  private isInitialised = false;

  public constructor(private targetOrgConnection: Connection) {
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

// function normaliseIdToCaseInsensitive(caseSensitiveId: string): string {
//   if (caseSensitiveId == null) {
//     return caseSensitiveId;
//   }
//   if (caseSensitiveId.length === 18) {
//     return caseSensitiveId;
//   }
//   let suffix = '';
//   for (let i = 0; i < 3; i++) {
//     let flags = 0;
//     for (let j = 0; j < 5; j++) {
//       const c = caseSensitiveId.charAt(i * 5 + j);
//       if (c >= 'A' && c <= 'Z') {
//         flags += 1 << j;
//       }
//     }
//     if (flags <= 25) {
//       suffix += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(flags);
//     } else {
//       suffix += '012345'.charAt(flags - 26);
//     }
//   }
//   return caseSensitiveId + suffix;
// }
