/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member, WorkflowAlertEntity } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, buildSubjectIdFilter } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class WorkflowAlert implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection) {
    this.queryRunner = new QueryRunner(this.queryConnection.tooling);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const alertDefinitions = await this.fetchAlertDefinitions(packageMembers);
    packageMembers.forEach((member) => {
      const alertDef = alertDefinitions.get(member.SubjectId);
      if (alertDef) {
        garbageList.push({
          developerName: alertDef.DeveloperName,
          fullyQualifiedName: `${alertDef.EntityDefinition.QualifiedApiName!}.${alertDef.DeveloperName}`,
          subjectId: alertDef.Id,
        });
      }
    });
    return { metadataType: 'WorkflowAlert', componentCount: garbageList.length, components: garbageList };
  }

  private async fetchAlertDefinitions(packageMembers: Package2Member[]): Promise<Map<string, WorkflowAlertEntity>> {
    const entitiesById = new Map<string, WorkflowAlertEntity>();
    const entityDefs = await this.queryRunner.fetchRecords<WorkflowAlertEntity>(
      `SELECT Id,DeveloperName,EntityDefinition.QualifiedApiName FROM WorkflowAlert WHERE ${buildSubjectIdFilter(
        packageMembers
      )}`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}
