/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler, resolvePackageDetails } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';

export class ApprovalProcessDefinition implements EntityDefinitionHandler {
  private readonly queryRunner: QueryRunner;

  public constructor(private readonly queryConnection: Connection) {
    this.queryRunner = new QueryRunner(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const defs = await this.fetchDefinitions(packageMembers);
    packageMembers.forEach((member) => {
      const approvalProcessDef = defs.get(member.SubjectId);
      if (approvalProcessDef) {
        // other entities have "01I" ids for custom objects, but approval processes have the
        // actual API name of the custom object (e.g. TestObject__c)
        garbageList.push({
          developerName: approvalProcessDef.DeveloperName,
          fullyQualifiedName: `${approvalProcessDef.TableEnumOrId}.${approvalProcessDef.DeveloperName}`,
          subjectId: member.SubjectId,
          ...resolvePackageDetails(member),
        });
      }
    });
    return {
      metadataType: 'ApprovalProcess',
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchDefinitions(packageMembers: Package2Member[]): Promise<Map<string, ProcessDefinition>> {
    const entitiesById = new Map<string, ProcessDefinition>();
    const entityDefs = await this.queryRunner.fetchRecords<ProcessDefinition>(
      `SELECT Id,DeveloperName,TableEnumOrId FROM ProcessDefinition WHERE ${buildSubjectIdFilter(
        packageMembers
      )} AND Type = 'Approval'`
    );
    entityDefs.forEach((ed) => entitiesById.set(ed.Id, ed));
    return entitiesById;
  }
}

type ProcessDefinition = {
  Id: string;
  DeveloperName: string;
  TableEnumOrId: string;
};
