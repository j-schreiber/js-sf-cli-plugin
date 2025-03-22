/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { DeveloperNamedRecord, Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class DeveloperNameEntity implements EntityDefinitionHandler {
  private readonly queryRunner: QueryRunner;

  public constructor(
    private readonly queryConnection: Connection | Connection['tooling'],
    private readonly entityName: string,
    private readonly metadataTypeName?: string
  ) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const entities = await this.fetchEntities(packageMembers);
    packageMembers.forEach((member) => {
      if (entities.has(member.SubjectId)) {
        garbageList.push(new PackageGarbage(member, entities.get(member.SubjectId)!.DeveloperName));
      }
    });
    return {
      metadataType: this.metadataTypeName ?? this.entityName,
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchEntities(packageMembers: Package2Member[]): Promise<Map<string, DeveloperNamedRecord>> {
    const entitiesById = new Map<string, DeveloperNamedRecord>();
    const entityDefs = await this.queryRunner.fetchRecords<DeveloperNamedRecord>(
      `SELECT Id,DeveloperName FROM ${this.entityName} WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}
