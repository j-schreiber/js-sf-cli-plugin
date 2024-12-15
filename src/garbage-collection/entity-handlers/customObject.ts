/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Record } from '@jsforce/jsforce-node';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class CustomObject implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection | Connection['tooling']) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const labelDefinitions = await this.queryRunner.fetchRecords<CustomObjectDefinition>(
      `SELECT Id,DeveloperName FROM CustomObject WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    labelDefinitions.forEach((def) => {
      garbageList.push({
        developerName: def.DeveloperName,
        fullyQualifiedName: def.DeveloperName,
        subjectId: def.Id!,
      });
    });
    return { components: garbageList, metadataType: 'CustomObject' };
  }
}

type CustomObjectDefinition = Record & {
  DeveloperName: string;
};
