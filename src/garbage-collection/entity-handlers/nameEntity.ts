/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { NamedRecord, Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class NameEntity implements EntityDefinitionHandler {
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
    const entityDefs = await this.fetchEntities(packageMembers);
    packageMembers.forEach((packageMember) => {
      if (entityDefs.has(packageMember.SubjectId)) {
        const def = entityDefs.get(packageMember.SubjectId)!;
        garbageList.push({
          developerName: def.Name,
          fullyQualifiedName: def.Name,
          subjectId: packageMember.SubjectId,
        });
      }
    });
    return {
      metadataType: this.metadataTypeName ?? this.entityName,
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchEntities(packageMembers: Package2Member[]): Promise<Map<string, NamedRecord>> {
    const entitiesById = new Map<string, NamedRecord>();
    const entityDefs = await this.queryRunner.fetchRecords<NamedRecord>(
      `SELECT Id,Name FROM ${this.entityName} WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}
