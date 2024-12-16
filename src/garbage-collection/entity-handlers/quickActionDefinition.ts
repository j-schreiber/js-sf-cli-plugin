/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, extractSubjectIds } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import ToolingApiConnection from '../toolingApiConnection.js';

export class QuickActionDefinition implements EntityDefinitionHandler {
  private apiConnection: ToolingApiConnection;

  public constructor(private queryConnection: Connection) {
    this.apiConnection = ToolingApiConnection.getInstance(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const quickActionDefs = await this.apiConnection.fetchQuickActions(extractSubjectIds(packageMembers));
    packageMembers.forEach((member) => {
      const actionDef = quickActionDefs.get(member.SubjectId);
      if (actionDef) {
        garbageList.push({
          developerName: actionDef.DeveloperName,
          fullyQualifiedName: `${actionDef.SobjectType}.${actionDef.DeveloperName}`,
          subjectId: member.SubjectId,
        });
      }
    });
    return { metadataType: 'QuickAction', componentCount: garbageList.length, components: garbageList };
  }
}
