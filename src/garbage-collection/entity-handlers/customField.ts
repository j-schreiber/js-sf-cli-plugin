/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { DeveloperNamedRecord, EntityDefinition, Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import QueryRunner from '../../common/utils/queryRunner.js';
import { ALL_CUSTOM_OBJECTS } from '../queries/queries.js';

export class CustomField implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection | Connection['tooling']) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = await this.fetchObjectDefinitions();
    const customFieldDefinitions = await this.queryRunner.fetchRecords<FieldDefinition>(
      `SELECT Id,DeveloperName,TableEnumOrId FROM CustomField WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    customFieldDefinitions.forEach((fieldDef) => {
      // field belongs to a custom object (or custom metadata, platform event, etc)
      if (fieldDef.TableEnumOrId.startsWith('01I')) {
        const customObjDef = objectsByDurableId.get(fieldDef.TableEnumOrId.substring(0, 15));
        if (customObjDef) {
          garbageList.push({
            developerName: fieldDef.DeveloperName,
            fullyQualifiedName: `${customObjDef.QualifiedApiName}.${fieldDef.DeveloperName}__c`,
            subjectId: fieldDef.Id,
          });
        }
      } else {
        // must be a custom field to a standard object
        garbageList.push({
          developerName: fieldDef.DeveloperName,
          fullyQualifiedName: `${fieldDef.TableEnumOrId}.${fieldDef.DeveloperName}__c`,
          subjectId: fieldDef.Id,
        });
      }
    });
    return { metadataType: 'CustomField', componentCount: garbageList.length, components: garbageList };
  }

  private async fetchObjectDefinitions(): Promise<Map<string, EntityDefinition>> {
    const objectsByDurableId = new Map<string, EntityDefinition>();
    const entityDefinitions = await this.queryRunner.fetchRecords<EntityDefinition>(ALL_CUSTOM_OBJECTS);
    entityDefinitions.forEach((entityDef) => {
      objectsByDurableId.set(entityDef.DurableId, entityDef);
    });
    return objectsByDurableId;
  }
}

type FieldDefinition = DeveloperNamedRecord & {
  Id: string;
  TableEnumOrId: string;
};
