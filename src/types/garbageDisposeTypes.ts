import { PackageGarbageContainer, PackageGarbageResult } from '../garbage-collection/packageGarbageTypes.js';

/**
 * - `Success`: all garbage was deleted
 * - `PartialSuccess`: some garbage was deleted, the rest could not be deleted (see `failed`)
 * - `Failed`: nothing was deleted
 * - `Skipped`: nothing to delete or aborted by user
 */
export type GarbageDisposeStatus = 'Success' | 'PartialSuccess' | 'Failed' | 'Skipped';

/**
 * A component that could not be deleted, with the reason from the deploy.
 */
export type GarbageDisposeFailure = {
  metadataType?: string;
  fullName: string;
  subjectId?: string;
  problem?: string;
};

export type GarbageDisposeResult = PackageGarbageResult & {
  status: GarbageDisposeStatus;
  deployId?: string;
  /**
   * Garbage that was deleted from the org, organised like `deprecatedMembers`.
   */
  disposed: { [x: string]: PackageGarbageContainer };
  /**
   * Garbage that could not be deleted.
   */
  failed: GarbageDisposeFailure[];
};
