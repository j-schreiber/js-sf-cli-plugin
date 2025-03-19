/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member, SobjectTypeDevNamedEntity } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler, resolvePackageDetails } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class SObjectBasedDefNameEntity implements EntityDefinitionHandler {
  private readonly queryRunner: QueryRunner;

  public constructor(
    private readonly queryConnection: Connection,
    private readonly entityName: string,
    private readonly metadataType?: string
  ) {
    this.queryRunner = new QueryRunner(this.queryConnection.tooling);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const defs = await this.fetchDefinitions(packageMembers);
    packageMembers.forEach((member) => {
      const actionDef = defs.get(member.SubjectId);
      if (actionDef) {
        garbageList.push({
          developerName: actionDef.DeveloperName,
          fullyQualifiedName: `${actionDef.SobjectType}.${actionDef.DeveloperName}`,
          subjectId: member.SubjectId,
          ...resolvePackageDetails(member),
        });
      }
    });
    return {
      metadataType: this.metadataType ?? this.entityName,
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchDefinitions(packageMembers: Package2Member[]): Promise<Map<string, SobjectTypeDevNamedEntity>> {
    const entitiesById = new Map<string, SobjectTypeDevNamedEntity>();
    const entityDefs = await this.queryRunner.fetchRecords<SobjectTypeDevNamedEntity>(
      `SELECT Id,DeveloperName,SobjectType FROM ${this.entityName} WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}
