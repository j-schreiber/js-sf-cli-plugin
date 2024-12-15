/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { EntityDefinition, Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import QueryRunner from '../../common/utils/queryRunner.js';
import { ALL_CUSTOM_OBJECTS } from '../queries/queries.js';

export class CustomObject implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection | Connection['tooling']) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = new Map<string, EntityDefinition>();
    const entityDefinitions = await this.queryRunner.fetchRecords<EntityDefinition>(ALL_CUSTOM_OBJECTS);
    entityDefinitions.forEach((entityDef) => {
      objectsByDurableId.set(entityDef.DurableId, entityDef);
    });
    packageMembers.forEach((pm) => {
      const definition = objectsByDurableId.get(pm.SubjectId.substring(0, 15));
      if (definition) {
        garbageList.push({
          developerName: definition.DeveloperName,
          fullyQualifiedName: definition.QualifiedApiName,
          subjectId: pm.SubjectId,
        });
      }
    });
    return { metadataType: 'CustomObject', componentCount: garbageList.length, components: garbageList };
  }
}
