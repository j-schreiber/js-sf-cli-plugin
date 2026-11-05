import { SfCommand } from '@salesforce/sf-plugins-core';
import { PackageGarbageResult } from '../../garbage-collection/packageGarbageTypes.js';
import { GarbageDisposeFailure } from '../../types/garbageDisposeTypes.js';

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

  /**
   * Prints all components that could not be deleted with their reason.
   * Prints nothing, if there are no failures.
   */
  public printFailures(failures: GarbageDisposeFailure[], title?: string): void {
    if (failures.length > 0) {
      this.cmd.table({
        data: failures,
        title,
        columns: [
          { key: 'metadataType', name: 'Metadata Type' },
          { key: 'fullName', name: 'Full Name' },
          { key: 'problem', name: 'Problem' },
        ],
      });
    }
  }
}
