/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, extractSubjectIds, resolvePackageDetails } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import ToolingApiConnection from '../toolingApiConnection.js';

export class CustomField implements EntityDefinitionHandler {
  private readonly apiConnection: ToolingApiConnection;

  public constructor(private readonly queryConnection: Connection) {
    this.apiConnection = ToolingApiConnection.getInstance(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = await this.apiConnection.fetchObjectDefinitionsByDurableId();
    const customFieldDefinitions = await this.apiConnection.fetchCustomFields(extractSubjectIds(packageMembers));
    packageMembers.forEach((member) => {
      const fieldDef = customFieldDefinitions.get(member.SubjectId);
      if (fieldDef && isNotDeleted(fieldDef.DeveloperName)) {
        // field belongs to a custom object (or custom metadata, platform event, etc)
        if (fieldDef.TableEnumOrId.startsWith('01I')) {
          const customObjDef = objectsByDurableId.get(fieldDef.TableEnumOrId.substring(0, 15));
          if (customObjDef) {
            garbageList.push({
              developerName: fieldDef.DeveloperName,
              fullyQualifiedName: `${customObjDef.QualifiedApiName}.${fieldDef.DeveloperName}__c`,
              subjectId: fieldDef.Id,
              ...resolvePackageDetails(member),
            });
          }
        } else {
          // must be a custom field to a standard object
          garbageList.push({
            developerName: fieldDef.DeveloperName,
            fullyQualifiedName: `${fieldDef.TableEnumOrId}.${fieldDef.DeveloperName}__c`,
            subjectId: fieldDef.Id,
            ...resolvePackageDetails(member),
          });
        }
      }
    });
    return { metadataType: 'CustomField', componentCount: garbageList.length, components: garbageList };
  }
}

function isNotDeleted(devName: string): boolean {
  return devName.search(/(_del)[\d]*$/) < 0;
}
