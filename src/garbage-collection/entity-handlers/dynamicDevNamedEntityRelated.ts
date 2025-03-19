/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { DynamicallyNamedEntity, Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, buildSubjectIdFilter, resolvePackageDetails } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class DynamicDevNamedEntityRelated<T extends DynamicallyNamedEntity> implements EntityDefinitionHandler {
  private readonly queryRunner: QueryRunner;

  public constructor(
    private readonly queryConnection: Connection,
    private readonly entityName: string,
    private readonly devName: string,
    private readonly metadataName?: string
  ) {
    this.queryRunner = new QueryRunner(this.queryConnection.tooling);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const definitions = await this.fetchDefinitions(packageMembers);
    packageMembers.forEach((member) => {
      const alertDef = definitions.get(member.SubjectId);
      if (alertDef) {
        garbageList.push({
          developerName: alertDef[this.devName] as string,
          fullyQualifiedName: `${alertDef.EntityDefinition.QualifiedApiName!}.${alertDef[this.devName] as string}`,
          subjectId: alertDef.Id,
          ...resolvePackageDetails(member),
        });
      }
    });
    return {
      metadataType: this.metadataName ?? this.entityName,
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchDefinitions(packageMembers: Package2Member[]): Promise<Map<string, T>> {
    const entitiesById = new Map<string, T>();
    const entityDefs = await this.queryRunner.fetchRecords<T>(
      `SELECT Id,${this.devName},EntityDefinition.QualifiedApiName FROM ${this.entityName} WHERE ${buildSubjectIdFilter(
        packageMembers
      )}`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}
