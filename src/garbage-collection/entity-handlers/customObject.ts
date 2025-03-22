/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import ToolingApiConnection from '../toolingApiConnection.js';

export class CustomObject implements EntityDefinitionHandler {
  public constructor(private readonly queryConnection: Connection) {}

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = await ToolingApiConnection.getInstance(
      this.queryConnection
    ).fetchObjectDefinitionsByDurableId();
    packageMembers.forEach((member) => {
      const definition = objectsByDurableId.get(member.SubjectId.substring(0, 15));
      if (definition) {
        garbageList.push(new PackageGarbage(member, definition.DeveloperName, definition.QualifiedApiName));
      }
    });
    return { metadataType: 'CustomObject', componentCount: garbageList.length, components: garbageList };
  }
}
