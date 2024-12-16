/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, extractSubjectIds } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbage.js';
import ToolingApiConnection from '../toolingApiConnection.js';

export class CustomField implements EntityDefinitionHandler {
  private apiConnection: ToolingApiConnection;

  public constructor(private queryConnection: Connection) {
    this.apiConnection = ToolingApiConnection.getInstance(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = await this.apiConnection.fetchObjectDefinitionsByDurableId();
    const customFieldDefinitions = await this.apiConnection.fetchCustomFields(extractSubjectIds(packageMembers));
    packageMembers.forEach((member) => {
      const fieldDef = customFieldDefinitions.get(member.SubjectId);
      if (fieldDef) {
        // field belongs to a custom object (or custom metadata, platform event, etc)
        if (fieldDef.TableEnumOrId.startsWith('01I')) {
          const customObjDef = objectsByDurableId.get(fieldDef.TableEnumOrId.substring(0, 15));
          if (customObjDef) {
            garbageList.push({
              developerName: fieldDef.DeveloperName,
              fullyQualifiedName: `${customObjDef.QualifiedApiName}.${fieldDef.DeveloperName}__c`,
              subjectId: fieldDef.Id,
            });
          }
        } else {
          // must be a custom field to a standard object
          garbageList.push({
            developerName: fieldDef.DeveloperName,
            fullyQualifiedName: `${fieldDef.TableEnumOrId}.${fieldDef.DeveloperName}__c`,
            subjectId: fieldDef.Id,
          });
        }
      }
    });
    return { metadataType: 'CustomField', componentCount: garbageList.length, components: garbageList };
  }
}