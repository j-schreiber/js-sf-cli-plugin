/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import {
  ComponentSet,
  DeployMessage,
  DestructiveChangesType,
  MetadataApiDeploy,
  MetadataApiDeployStatus,
  RegistryAccess,
  SourceComponent,
} from '@salesforce/source-deploy-retrieve';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';
import {
  GarbageCollectionUx,
  GarbageCollector,
  resolveDevhub,
  resolvePackageIds,
} from '../../../../garbage-collection/index.js';
import type {
  GarbageDisposeFailure,
  GarbageDisposeResult,
  PackageGarbage,
  PackageGarbageContainer,
  PackageGarbageResult,
} from '../../../../garbage-collection/types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.dispose');

/**
 * Each round removes at least one failing component. Usually the org reports
 * all failures in the first round, follow-up rounds only catch components that
 * failed because of references to other failed components.
 */
const MAX_VALIDATION_ROUNDS = 3;

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

type ValidationResult = {
  deletable: GarbageEntry[];
  failed: GarbageDisposeFailure[];
  validation?: { deploy: MetadataApiDeploy; response: MetadataApiDeployStatus };
};

export default class JscMaintainGarbageDispose extends SfCommand<GarbageDisposeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'devhub-org': Flags.optionalHub({
      summary: messages.getMessage('flags.devhub-org.summary'),
      description: messages.getMessage('flags.devhub-org.description'),
      char: 'v',
      required: false,
    }),
    'metadata-type': Flags.string({
      multiple: true,
      char: 'm',
      summary: messages.getMessage('flags.metadata-type.summary'),
      description: messages.getMessage('flags.metadata-type.description'),
    }),
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      multiple: true,
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      description: messages.getMessage('flags.no-prompt.description'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<GarbageDisposeResult> {
    const { flags } = await this.parse(JscMaintainGarbageDispose);
    const orgConnection = flags['target-org'].getConnection(flags['api-version']);
    const devhubConnection = resolveDevhub(flags['target-org'], flags['devhub-org'], flags['api-version']);
    const collector = GarbageCollector.newInstance(orgConnection, devhubConnection);
    collector.on('resolveMemberStatus', (payload: CommandStatusEvent) => {
      this.info(payload.message!);
    });
    const filter = {
      includeOnly: flags['metadata-type'],
      packages: await resolvePackageIds(orgConnection, (msg) => this.info(msg), flags.package),
    };
    const garbage = await collector.export(filter);
    process.exitCode = 0;
    const entries = resolveGarbageEntries(garbage);
    if (entries.length === 0) {
      this.info(messages.getMessage('infos.no-garbage-found'));
      return { ...garbage, status: 'Skipped', disposed: {}, failed: [] };
    }

    const { deletable, failed, validation } = await this.validate(entries, orgConnection);
    const ux = new GarbageCollectionUx(this);
    ux.printTable({ ...garbage, deprecatedMembers: groupEntries(deletable) }, messages.getMessage('titles.deletable'));
    ux.printFailures(failed, messages.getMessage('titles.not-deletable'));
    if (deletable.length === 0 || !validation) {
      this.logToStderr(messages.getMessage('errors.nothing-deletable', [failed.length]));
      process.exitCode = 1;
      return { ...garbage, status: 'Failed', disposed: {}, failed };
    }

    if (!(await this.confirmDisposal(flags['no-prompt'], deletable.length, failed.length, orgConnection))) {
      this.info(messages.getMessage('infos.aborted-by-user'));
      return { ...garbage, status: 'Skipped', disposed: {}, failed };
    }

    const { response } = await this.deployValidated(deletable, validation, orgConnection);
    if (!isTrue(response.success)) {
      const deployFailures = toFailures(response, deletable);
      ux.printFailures(deployFailures, messages.getMessage('titles.deploy-failures'));
      this.logToStderr(messages.getMessage('errors.disposal-failed', [deployFailures.length]));
      process.exitCode = 1;
      return {
        ...garbage,
        status: 'Failed',
        deployId: response.id,
        disposed: {},
        failed: [...failed, ...deployFailures],
      };
    }
    // The deploy response is not reliable to determine what was deleted (cascading
    // deletes are not reported, some "deleted" components remain in the org).
    // Collect garbage again and compare: only what is gone counts as disposed.
    collector.removeAllListeners('resolveMemberStatus');
    this.spinner.start(messages.getMessage('infos.verifying'));
    const remainingGarbage = await collector.export(filter);
    this.spinner.stop();
    const { deleted, notDeleted } = verifyDeletions(response, deletable, remainingGarbage);
    if (notDeleted.length > 0) {
      ux.printFailures(notDeleted, messages.getMessage('titles.not-deleted'));
    }
    const allFailed = [...failed, ...notDeleted];
    if (deleted.length === 0) {
      this.logToStderr(messages.getMessage('errors.nothing-deleted', [notDeleted.length]));
      process.exitCode = 1;
      return { ...garbage, status: 'Failed', deployId: response.id, disposed: {}, failed: allFailed };
    }
    this.logSuccess(messages.getMessage('infos.disposal-succeeded', [deleted.length]));
    if (allFailed.length > 0) {
      this.warn(messages.getMessage('warnings.partial-success', [allFailed.length]));
    }
    return {
      ...garbage,
      status: allFailed.length > 0 ? 'PartialSuccess' : 'Success',
      deployId: response.id,
      disposed: groupEntries(deleted),
      failed: allFailed,
    };
  }

  /**
   * Validates (check-only) destructive changes and removes all components that fail,
   * until a validation succeeds, no components are left, or no progress is made.
   */
  private async validate(entries: GarbageEntry[], connection: Connection): Promise<ValidationResult> {
    let remaining = entries;
    const failed: GarbageDisposeFailure[] = [];
    this.spinner.start(messages.getMessage('infos.validating'));
    try {
      for (let round = 1; round <= MAX_VALIDATION_ROUNDS; round++) {
        this.spinner.status = messages.getMessage('infos.validation-round', [round, remaining.length]);
        const deploy = await buildComponentSet(remaining, connection).deploy({
          usernameOrConnection: connection,
          apiOptions: { checkOnly: true },
        });
        const { response } = await deploy.pollStatus();
        if (isTrue(response.success)) {
          return { deletable: remaining, failed, validation: { deploy, response } };
        }
        const assigned = assignFailures(response, remaining);
        if (assigned.size === 0) {
          // validation failed, but not because of a component we could remove
          failed.push(...toFailures(response, remaining));
          return { deletable: [], failed };
        }
        assigned.forEach((problems, entry) => failed.push(toFailure(entry, problems.join(' | '))));
        remaining = remaining.filter((entry) => !assigned.has(entry));
        if (remaining.length === 0) {
          return { deletable: [], failed };
        }
      }
      failed.push(
        ...remaining.map((entry) =>
          toFailure(entry, messages.getMessage('errors.max-validation-rounds', [MAX_VALIDATION_ROUNDS]))
        )
      );
      return { deletable: [], failed };
    } finally {
      this.spinner.stop();
    }
  }

  /**
   * Deploys the last successful validation. Uses quick deploy, if the validation
   * ran apex tests (e.g. when deleting apex in production), so tests don't run twice.
   */
  private async deployValidated(
    deletable: GarbageEntry[],
    validation: NonNullable<ValidationResult['validation']>,
    connection: Connection
  ): Promise<{ response: MetadataApiDeployStatus }> {
    this.spinner.start(messages.getMessage('infos.deleting'));
    try {
      let deploy: MetadataApiDeploy;
      if (isTrue(validation.response.runTestsEnabled)) {
        const quickDeployId = await validation.deploy.deployRecentValidation();
        this.info(messages.getMessage('infos.quick-deploy-started', [quickDeployId, validation.response.id]));
        deploy = new MetadataApiDeploy({ id: quickDeployId, usernameOrConnection: connection });
      } else {
        deploy = await buildComponentSet(deletable, connection).deploy({ usernameOrConnection: connection });
        this.info(messages.getMessage('infos.deploy-started', [deploy.id]));
      }
      deploy.onUpdate((status: MetadataApiDeployStatus) => {
        this.spinner.status = messages.getMessage('infos.deploy-status', [
          status.status,
          status.numberComponentsDeployed,
          status.numberComponentsTotal,
        ]);
      });
      return await deploy.pollStatus();
    } finally {
      this.spinner.stop();
    }
  }

  private async confirmDisposal(
    noPrompt: boolean,
    deletableCount: number,
    failedCount: number,
    connection: Connection
  ): Promise<boolean> {
    if (noPrompt) {
      return true;
    }
    if (failedCount > 0) {
      this.info(messages.getMessage('infos.not-deletable-skipped', [failedCount]));
    }
    return this.confirm({
      message: messages.getMessage('confirmDisposal', [deletableCount, connection.getUsername()]),
    });
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

function buildComponentSet(entries: GarbageEntry[], connection: Connection): ComponentSet {
  const components = new ComponentSet();
  components.apiVersion = connection.getApiVersion();
  entries.forEach((entry) => components.add(entry.component, DestructiveChangesType.POST));
  return components;
}

/**
 * Compares deployed entries with garbage that was collected after the deploy.
 * Entries that are no longer garbage are deleted, all others are not deleted
 * (with the problem from the deploy, if the deploy reported one for the component).
 */
function verifyDeletions(
  response: MetadataApiDeployStatus,
  entries: GarbageEntry[],
  remainingGarbage: PackageGarbageResult
): { deleted: GarbageEntry[]; notDeleted: GarbageDisposeFailure[] } {
  const remainingIds = new Set(
    Object.values(remainingGarbage.deprecatedMembers).flatMap((container) =>
      container.components.map((cmp) => cmp.subjectId)
    )
  );
  const problems = new Map(
    [...toArray(response.details?.componentSuccesses), ...toArray(response.details?.componentFailures)]
      .filter((msg) => msg.problem)
      .map((msg) => [componentKey(msg.componentType, msg.fullName), msg.problem])
  );
  const deleted: GarbageEntry[] = [];
  const notDeleted: GarbageDisposeFailure[] = [];
  entries.forEach((entry) => {
    if (remainingIds.has(entry.garbage.subjectId)) {
      notDeleted.push(
        toFailure(entry, problems.get(entry.key) ?? messages.getMessage('errors.deletion-not-confirmed'))
      );
    } else {
      deleted.push(entry);
    }
  });
  return { deleted, notDeleted };
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
