import { SfCommand } from '@salesforce/sf-plugins-core';
import { PackageGarbageResult } from './packageGarbageTypes.js';

type TableOutputRow = {
  metadataType: string;
  subjectId: string;
  fullyQualifiedApiName: string;
  deprecatedSinceVersion?: string;
  packageName?: string;
};

/**
 * Reusable console output for garbage collection commands.
 */
export default class GarbageCollectionUx {
  public constructor(private readonly cmd: Pick<SfCommand<unknown>, 'table'>) {}

  /**
   * Prints all deprecated members as a single table. Prints nothing,
   * if the garbage is empty.
   */
  public printTable(garbage: PackageGarbageResult, title?: string): void {
    const data: TableOutputRow[] = [];
    Object.values(garbage.deprecatedMembers).forEach((container) => {
      container.components.forEach((member) => {
        data.push({
          subjectId: member.subjectId,
          metadataType: container.metadataType,
          fullyQualifiedApiName: member.fullyQualifiedName,
          packageName: member.packageName,
          deprecatedSinceVersion: member.deprecatedSinceVersion,
        });
      });
    });
    if (data.length > 0) {
      this.cmd.table({ data, title });
    }
  }
}
