/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { DeveloperNamedRecord, Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class DeveloperNameEntity implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(
    private queryConnection: Connection | Connection['tooling'],
    private entityName: string,
    private metadataTypeName?: string
  ) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const entityDefs = await this.queryRunner.fetchRecords<DeveloperNamedRecord>(
      `SELECT Id,DeveloperName FROM ${this.entityName} WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    entityDefs.forEach((def) => {
      garbageList.push({
        developerName: def.DeveloperName,
        fullyQualifiedName: def.DeveloperName,
        subjectId: def.Id!,
      });
    });
    return { components: garbageList, metadataType: this.metadataTypeName ?? this.entityName };
  }
}
