/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbageContainer, UnknownPackageGarbage } from '../packageGarbage.js';

export class UnsupportedEntity implements EntityDefinitionHandler {
  public constructor(private metadataType: string) {}

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: UnknownPackageGarbage[] = [];
    packageMembers.forEach((member) => {
      garbageList.push({ subjectId: member.SubjectId });
    });
    return { components: garbageList, metadataType: this.metadataType };
  }
}
