import type { PackageGarbageContainer, PackageGarbageResult } from '../garbage-collection/types.js';

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

export type GarbageDisposeOptions = {
  /**
   * Maximum number of validation rounds (check-only deploys). Each round removes
   * components that cannot be deleted. Defaults to 3.
   */
  maxValidationRounds?: number;
};

/**
 * Events emitted by `GarbageDisposer`. Payloads are data, formatting is up to the subscriber.
 */
export type GarbageDisposerEvents = {
  /** A validation (check-only deploy) round starts. */
  validationRound: [{ round: number; componentCount: number }];
  /** The destructive deploy started. `validationId` is set, if it is a quick deploy of that validation. */
  deployStarted: [{ deployId: string; validationId?: string }];
  /** Status update of the running destructive deploy. */
  deployProgress: [{ status: string; componentsDeployed: number; componentsTotal: number }];
};
