/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection, Messages, SfError } from '@salesforce/core';
import {
  ComponentSet,
  DeployMessage,
  DestructiveChangesType,
  MetadataApiDeploy,
  MetadataApiDeployStatus,
  RegistryAccess,
  SourceComponent,
} from '@salesforce/source-deploy-retrieve';
import type { PackageGarbage, PackageGarbageContainer, PackageGarbageResult } from '../garbage-collection/types.js';
import PackageManifestBuilder from '../common/packageManifestBuilder.js';
import type {
  GarbageDisposeFailure,
  GarbageDisposeOptions,
  GarbageDisposeResult,
  GarbageDisposeStatus,
  GarbageDisposerEvents,
} from './garbageDisposeTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagedisposal');

/**
 * Each round removes at least one failing component. Usually the org reports
 * all failures in the first round, follow-up rounds only catch components that
 * failed because of references to other failed components.
 */
const DEFAULT_MAX_VALIDATION_ROUNDS = 3;

/**
 * A single deletable garbage component with its resolved registry component.
 */
type GarbageEntry = {
  key: string;
  containerKey: string;
  container: PackageGarbageContainer;
  garbage: PackageGarbage;
  component: SourceComponent;
};

type Validation = {
  deletable: GarbageEntry[];
  failed: GarbageDisposeFailure[];
  validationId?: string;
  quickDeployable: boolean;
};

/**
 * Deletes collected package garbage from an org with destructive deploys.
 *
 * `dispose(garbage)` validates the deletion (check-only) and removes components that
 * cannot be deleted, until a validation succeeds. It deploys the validated garbage
 * (quick deploy, if the validation ran tests).
 *
 * `manifestFrom(garbage)` creates a package manifest with all garbage.
 *
 * Progress is reported with typed events (`GarbageDisposerEvents`).
 */
export default class GarbageDisposer extends EventEmitter<GarbageDisposerEvents> {
  public constructor(private readonly connection: Connection) {
    super();
  }

  public static newInstance(connection: Connection): GarbageDisposer {
    return new GarbageDisposer(connection);
  }

  /**
   * Creates a package manifest with all deprecated members of the garbage.
   */
  // eslint-disable-next-line class-methods-use-this -- part of the disposer API, needs no org access
  public manifestFrom(garbage: PackageGarbageResult): PackageManifestBuilder {
    const manifest = new PackageManifestBuilder();
    Object.values(garbage.deprecatedMembers).forEach((container) => {
      container.components.forEach((cmp) => manifest.addMember(container.metadataType, cmp.fullyQualifiedName));
    });
    return manifest;
  }

  /**
   * Deletes the garbage from the org. Does not modify the input. Metadata types that
   * are unknown to the metadata registry are moved to `unsupported` in the result.
   *
   * @param input Collected garbage
   * @param options Optional settings
   * @returns Result with disposed and failed garbage
   */
  public async dispose(
    input: PackageGarbageResult,
    options: GarbageDisposeOptions = {}
  ): Promise<GarbageDisposeResult> {
    const maxValidationRounds = options.maxValidationRounds ?? DEFAULT_MAX_VALIDATION_ROUNDS;
    if (!Number.isInteger(maxValidationRounds) || maxValidationRounds < 1) {
      throw new SfError(messages.getMessage('errors.invalid-max-validation-rounds', [maxValidationRounds]));
    }
    const garbage = structuredClone(input);
    const entries = resolveGarbageEntries(garbage);
    const result = (
      status: GarbageDisposeStatus,
      failed: GarbageDisposeFailure[] = [],
      deployId?: string,
      disposed: GarbageDisposeResult['disposed'] = {}
    ): GarbageDisposeResult => ({ ...garbage, status, deployId, disposed, failed });
    if (entries.length === 0) {
      return result('Skipped');
    }

    const validation = await this.validate(entries, maxValidationRounds);
    if (!validation.validationId) {
      return result('Failed', validation.failed);
    }

    const response = await this.deploy(validation);
    if (!isTrue(response.success)) {
      return result('Failed', [...validation.failed, ...toFailures(response, validation.deletable)], response.id);
    }

    // the deploy is atomic: if it succeeds, all deployed garbage is deleted
    return result(
      validation.failed.length > 0 ? 'PartialSuccess' : 'Success',
      validation.failed,
      response.id,
      groupEntries(validation.deletable)
    );
  }

  //      PRIVATE ZONE

  /**
   * Validates (check-only) destructive changes and removes all components that fail,
   * until a validation succeeds, no components are left, or no progress is made.
   */
  private async validate(entries: GarbageEntry[], maxRounds: number): Promise<Validation> {
    let remaining = entries;
    const failed: GarbageDisposeFailure[] = [];
    for (let round = 1; round <= maxRounds && remaining.length > 0; round++) {
      this.emit('validationRound', { round, componentCount: remaining.length });
      const deploy = await this.buildComponentSet(remaining).deploy({
        usernameOrConnection: this.connection,
        apiOptions: { checkOnly: true },
      });
      const { response } = await deploy.pollStatus();
      if (isTrue(response.success)) {
        return {
          deletable: remaining,
          failed,
          validationId: response.id,
          quickDeployable: isTrue(response.runTestsEnabled),
        };
      }
      const assigned = assignFailures(response, remaining);
      if (assigned.size === 0) {
        // validation failed, but not because of a component we could remove
        failed.push(...toFailures(response, remaining));
        remaining = [];
        break;
      }
      assigned.forEach((problems, entry) => failed.push(toFailure(entry, problems.join(' | '))));
      remaining = remaining.filter((entry) => !assigned.has(entry));
    }
    failed.push(
      ...remaining.map((entry) => toFailure(entry, messages.getMessage('errors.max-validation-rounds', [maxRounds])))
    );
    return { deletable: [], failed, quickDeployable: false };
  }

  /**
   * Deploys the deletable garbage of a successful validation. Uses quick deploy, if the
   * validation ran apex tests (e.g. when deleting apex in production), so tests don't run twice.
   */
  private async deploy(validation: Validation): Promise<MetadataApiDeployStatus> {
    let deploy: MetadataApiDeploy;
    if (validation.quickDeployable) {
      const validated = new MetadataApiDeploy({ id: validation.validationId, usernameOrConnection: this.connection });
      const quickDeployId = await validated.deployRecentValidation();
      deploy = new MetadataApiDeploy({ id: quickDeployId, usernameOrConnection: this.connection });
      this.emit('deployStarted', { deployId: quickDeployId, validationId: validation.validationId });
    } else {
      deploy = await this.buildComponentSet(validation.deletable).deploy({ usernameOrConnection: this.connection });
      this.emit('deployStarted', { deployId: deploy.id! });
    }
    deploy.onUpdate((status: MetadataApiDeployStatus) => {
      this.emit('deployProgress', {
        status: status.status,
        componentsDeployed: status.numberComponentsDeployed,
        componentsTotal: status.numberComponentsTotal,
      });
    });
    return (await deploy.pollStatus()).response;
  }

  private buildComponentSet(entries: GarbageEntry[]): ComponentSet {
    const components = new ComponentSet();
    components.apiVersion = this.connection.getApiVersion();
    entries.forEach((entry) => components.add(entry.component, DestructiveChangesType.POST));
    return components;
  }
}

/**
 * Maps all garbage to registry components. Containers with metadata types that
 * are not known to the registry are moved to `unsupported` and removed from
 * `deprecatedMembers`, so they are neither shown nor counted as garbage.
 */
function resolveGarbageEntries(garbage: PackageGarbageResult): GarbageEntry[] {
  const registry = new RegistryAccess();
  const entries: GarbageEntry[] = [];
  for (const [containerKey, container] of Object.entries(garbage.deprecatedMembers)) {
    if (container.componentCount === 0) {
      continue;
    }
    try {
      const type = registry.getTypeByName(container.metadataType);
      container.components.forEach((cmp) => {
        entries.push({
          key: componentKey(type.name, cmp.fullyQualifiedName),
          containerKey,
          container,
          garbage: cmp,
          component: new SourceComponent({ name: cmp.fullyQualifiedName, type }),
        });
      });
    } catch {
      garbage.unsupported.push({
        keyPrefix: container.components[0].subjectId.substring(0, 3),
        entityName: containerKey,
        componentCount: container.componentCount,
        reason: messages.getMessage('unsupported-by-registry', [container.metadataType]),
      });
      garbage.totalDeprecatedComponentCount -= container.componentCount;
      delete garbage.deprecatedMembers[containerKey];
    }
  }
  return entries;
}

/**
 * Re-organises entries by their original garbage container.
 */
function groupEntries(entries: GarbageEntry[]): { [x: string]: PackageGarbageContainer } {
  const grouped: { [x: string]: PackageGarbageContainer } = {};
  entries.forEach((entry) => {
    grouped[entry.containerKey] ??= { metadataType: entry.container.metadataType, componentCount: 0, components: [] };
    grouped[entry.containerKey].components.push(entry.garbage);
    grouped[entry.containerKey].componentCount++;
  });
  return grouped;
}

/**
 * Assigns all component failures of a deploy to the garbage entries they belong to.
 * Failures are usually reported for the component itself (`componentType` + `fullName`).
 * Some failures are reported for the manifest (`fullName` = `destructiveChanges.xml`):
 * these are assigned to entries of the same type that are mentioned in the problem,
 * or to all entries of that type, if the problem mentions none of them.
 * Entries with multiple failures collect all problems.
 */
function assignFailures(response: MetadataApiDeployStatus, entries: GarbageEntry[]): Map<GarbageEntry, string[]> {
  const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const assigned = new Map<GarbageEntry, string[]>();
  toArray(response.details?.componentFailures).forEach((failure: DeployMessage) => {
    const exactMatch = entriesByKey.get(componentKey(failure.componentType, failure.fullName));
    const targets = exactMatch ? [exactMatch] : matchManifestLevelFailure(failure, entries);
    const problem = failure.problem ?? response.errorMessage ?? '';
    targets.forEach((entry) => {
      const problems = assigned.get(entry) ?? [];
      if (!problems.includes(problem)) {
        problems.push(problem);
      }
      assigned.set(entry, problems);
    });
  });
  return assigned;
}

function matchManifestLevelFailure(failure: DeployMessage, entries: GarbageEntry[]): GarbageEntry[] {
  if (!failure.componentType) {
    return [];
  }
  const sameType = entries.filter(
    (entry) => entry.component.type.name.toLowerCase() === failure.componentType!.toLowerCase()
  );
  const mentioned = sameType.filter((entry) => failure.problem?.includes(entry.garbage.fullyQualifiedName));
  return mentioned.length > 0 ? mentioned : sameType;
}

/**
 * Maps a failed deploy to failures of garbage entries. If no failure can be
 * assigned to an entry, all entries are failed with the deploy error message.
 */
function toFailures(response: MetadataApiDeployStatus, entries: GarbageEntry[]): GarbageDisposeFailure[] {
  const assigned = assignFailures(response, entries);
  if (assigned.size === 0) {
    return entries.map((entry) => toFailure(entry, response.errorMessage));
  }
  return Array.from(assigned, ([entry, problems]) => toFailure(entry, problems.join(' | ')));
}

function toFailure(entry: GarbageEntry, problem?: string): GarbageDisposeFailure {
  return {
    metadataType: entry.component.type.name,
    fullName: entry.garbage.fullyQualifiedName,
    subjectId: entry.garbage.subjectId,
    problem: problem ?? messages.getMessage('errors.unknown-deploy-error'),
  };
}

function componentKey(metadataType: string | undefined, fullName: string): string {
  return `${metadataType ?? ''}#${fullName}`.toLowerCase();
}

function isTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

function toArray<T>(value?: T | T[]): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
