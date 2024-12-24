/* eslint-disable @typescript-eslint/require-await */
import { Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionIgnorer } from '../entityDefinitionHandler.js';
import { IgnoredPackageGarbageContainer } from '../packageGarbageTypes.js';

export class UnsupportedEntity implements EntityDefinitionIgnorer {
  public constructor(private metadataType: string, private ignoreReason: string) {}

  public async resolve(packageMembers: Package2Member[]): Promise<IgnoredPackageGarbageContainer> {
    return {
      metadataType: this.metadataType,
      componentCount: packageMembers.length,
      reason: this.ignoreReason,
    };
  }
}
