/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { FullNameSingleRecordEntity, Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class FullNameSingleRecord implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(
    private queryConnection: Connection['tooling'],
    private entityName: string,
    private metadataTypeName?: string
  ) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    for (const packageMember of packageMembers) {
      // queries with "FullName" throw exception, if more than one record is queried
      // so yes, we do "SOQL in a loop" here. For performence reasons. LOL.
      // eslint-disable-next-line no-await-in-loop
      const entityDef = await this.queryRunner.fetchRecords<FullNameSingleRecordEntity>(
        `SELECT Id,FullName FROM ${this.entityName} WHERE Id = '${packageMember.SubjectId}' LIMIT 1`
      );
      if (entityDef.length > 0) {
        garbageList.push({
          developerName: entityDef[0].FullName,
          fullyQualifiedName: entityDef[0].FullName,
          subjectId: packageMember.SubjectId,
        });
      }
    }
    return {
      metadataType: this.metadataTypeName ?? this.entityName,
      componentCount: garbageList.length,
      components: garbageList,
    };
  }
}
