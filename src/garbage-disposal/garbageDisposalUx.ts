import { SfCommand } from '@salesforce/sf-plugins-core';
import type { GarbageDisposeFailure } from './garbageDisposeTypes.js';

/**
 * Reusable console output for garbage disposal.
 */
export default class GarbageDisposalUx {
  public constructor(private readonly cmd: Pick<SfCommand<unknown>, 'table'>) {}

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
