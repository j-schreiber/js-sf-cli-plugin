/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Record } from '@jsforce/jsforce-node';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class ExternalString implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection | Connection['tooling']) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const labelDefinitions = await this.queryRunner.fetchRecords<LabelDefinition>(
      `SELECT Id,Name FROM ExternalString WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    labelDefinitions.forEach((def) => {
      garbageList.push({
        developerName: def.Name,
        fullyQualifiedName: def.Name,
        subjectId: def.Id!,
      });
    });
    return { components: garbageList, metadataType: 'CustomLabel' };
  }
}

type LabelDefinition = Record & {
  Name: string;
};
