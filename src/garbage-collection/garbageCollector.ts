import EventEmitter from 'node:events';
import { Connection, Messages, SfError } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { EntityDefinition, InstalledSubscriberPackage, Package2, Package2Member } from '../types/sfToolingApiTypes.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { GarbageFilter, PackageGarbageResult } from './packageGarbageTypes.js';
import {
  PACKAGE_2,
  PACKAGE_MEMBER_BASE,
  ALL_DEPRECATED_PACKAGE_MEMBERS,
  INSTALLED_SUBSCRIBER_PACKAGES,
} from './queries.js';
import ToolingApiConnection from './toolingApiConnection.js';
import PackageMemberFilter from './packageMemberFilter.js';
import TrashBin from './trashBin.js';

const PACKAGE_2_PREFIX = '0Ho';
const SUBSCRIBER_PACKAGE_PREFIX = '033';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

export default class GarbageCollector extends EventEmitter {
  private readonly toolingObjectsRunner: QueryRunner;
  private readonly toolingApiCache: ToolingApiConnection;
  private readonly devhubQueryRunner?: QueryRunner;

  public constructor(private readonly targetOrgConnection: Connection, private readonly devhubConnection?: Connection) {
    super();
    this.toolingObjectsRunner = new QueryRunner(this.targetOrgConnection.tooling);
    this.toolingApiCache = ToolingApiConnection.getInstance(this.targetOrgConnection);
    if (this.devhubConnection) {
      this.devhubQueryRunner = new QueryRunner(this.devhubConnection.tooling);
    }
  }

  //      PUBLIC STATIC

  public static newInstance(targetOrgConnection: Connection, devhubConnection?: Connection): GarbageCollector {
    return new GarbageCollector(targetOrgConnection, devhubConnection);
  }

  //      PUBLIC API

  public async export(filter?: GarbageFilter): Promise<PackageGarbageResult> {
    const bin = new TrashBin(this.targetOrgConnection);
    bin.on('resolve', (payload: CommandStatusEvent) => {
      this.emitResolveStatus(payload.message!);
    });
    this.parseInputs(filter);
    const members = await this.fetchPackageMembers2(filter);
    await this.resolveSubscriberPackage(members);
    await bin.pushPackageMembers(members);
    return bin.format();
  }

  //      PRIVATE ZONE

  private parseInputs(filter?: GarbageFilter): void {
    if (filter?.packages?.some((pkg) => pkg.startsWith(PACKAGE_2_PREFIX)) && !this.devhubConnection) {
      throw new SfError(
        messages.getMessage('packages-filter-no-devhub'),
        'DevhubRequiredForPackages',
        [messages.getMessage('provide-valid-devhub-with-filter')],
        2
      );
    }
    if (filter?.packages && filter.packages.length > 0) {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: messages.getMessage('infos.packages-filter-active', [filter.packages.join(',')]),
      });
    }
    if (filter?.includeOnly && filter.includeOnly.length > 0) {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: messages.getMessage('infos.metadata-filter-active', [filter.includeOnly.join(',')]),
      });
    }
  }

  private async fetchPackageMembers2(filter?: GarbageFilter): Promise<Package2Member[]> {
    const filteredEntityDefs = await this.toolingApiCache.resolveEntityDefinitionNames(filter?.includeOnly);
    const memberFilter = new PackageMemberFilter(
      await this.resolveSubscriberPackageIds(filter?.packages),
      filteredEntityDefs
    );
    const packageMembers = await this.toolingObjectsRunner.fetchRecords<Package2Member>(
      buildPackageMemberQueryString(filteredEntityDefs, filter)
    );
    packageMembers.push(...(await this.buildFlowPackageMembers()));
    return packageMembers.filter((member) => memberFilter.isAllowed(member));
  }

  private async buildFlowPackageMembers(): Promise<Package2Member[]> {
    const packagedFlowDefinitions = await this.toolingObjectsRunner.fetchRecords<Package2Member>(
      QueryBuilder.sanitise(`${PACKAGE_MEMBER_BASE} WHERE SubjectKeyPrefix = '300'`)
    );
    return packagedFlowDefinitions;
  }

  /**
   * Resolves the packages filter to subscriber package ids (033), which package members
   * reference. Accepts subscriber package ids (033, used as is), package ids (0Ho, resolved
   * on the devhub), and package names or namespaces (resolved on the target org, case-insensitive).
   * Throws, if a filter is set, but none of its packages resolve: an unresolved filter must
   * never widen to all packages.
   *
   * @param packages
   * @returns Subscriber package ids. Empty, if no filter is set.
   */
  private async resolveSubscriberPackageIds(packages?: string[]): Promise<string[]> {
    if (!packages || packages.length === 0) {
      return [];
    }
    const subscriberPackageIds = new Set(packages.filter((pkg) => pkg.startsWith(SUBSCRIBER_PACKAGE_PREFIX)));
    const package2s = await this.resolvePackageIds(packages.filter((pkg) => pkg.startsWith(PACKAGE_2_PREFIX)));
    package2s.forEach((p2) => subscriberPackageIds.add(p2.SubscriberPackageId));
    const names = packages.filter(
      (pkg) => !pkg.startsWith(SUBSCRIBER_PACKAGE_PREFIX) && !pkg.startsWith(PACKAGE_2_PREFIX)
    );
    if (names.length > 0) {
      const installed = await this.toolingObjectsRunner.fetchRecords<
        Pick<InstalledSubscriberPackage, 'SubscriberPackageId' | 'SubscriberPackage'>
      >(INSTALLED_SUBSCRIBER_PACKAGES);
      names.forEach((name) => {
        const matches = installed.filter((pkg) => matchesNameOrNamespace(pkg.SubscriberPackage, name));
        if (matches.length === 0) {
          this.emitResolveStatus(
            messages.getMessage('warnings.failed-to-resolve-package-name', [
              name,
              this.targetOrgConnection.getUsername(),
            ])
          );
        }
        matches.forEach((pkg) => {
          this.emitResolveStatus(messages.getMessage('infos.resolved-package-name', [name, pkg.SubscriberPackageId]));
          subscriberPackageIds.add(pkg.SubscriberPackageId!);
        });
      });
    }
    if (subscriberPackageIds.size === 0) {
      throw new SfError(messages.getMessage('errors.no-package-resolved', [packages.join(', ')]), 'NoPackageResolved');
    }
    return [...subscriberPackageIds];
  }

  /**
   * Input is list of 0Ho "Package2Ids", output is a resolved list of Package2 records.
   *
   * @param packageIds
   * @returns
   */
  private async resolvePackageIds(packageIds?: string[]): Promise<Package2[]> {
    if (!packageIds || packageIds.length === 0) {
      return [];
    }
    const package2s = await this.devhubQueryRunner!.fetchRecords<Package2>(
      `${PACKAGE_2} WHERE ${QueryBuilder.buildParamListFilter('Id', packageIds)}`
    );
    const resolvedIds: string[] = [];
    package2s.forEach((p2) => {
      this.emitResolveStatus(messages.getMessage('infos.resolved-package-id', [p2.Id, p2.SubscriberPackageId]));
      resolvedIds.push(p2.Id);
    });
    const unresolvedPackageIds = packageIds.filter((id) => !resolvedIds.includes(id));
    unresolvedPackageIds.forEach((id) => {
      this.emitResolveStatus(
        messages.getMessage('warnings.failed-to-resolved-package-id', [id, this.devhubConnection?.getUsername()])
      );
    });
    return package2s;
  }

  private async resolveSubscriberPackage(members: Package2Member[]): Promise<void> {
    const uniqueIds = [...new Set(members.map((member) => member.SubscriberPackageId))];
    const packages = await this.toolingApiCache.resolveSubscriberPackageIds(uniqueIds);
    for (const member of members) {
      member.SubscriberPackage = packages.get(member.SubscriberPackageId);
    }
  }

  private emitResolveStatus(message: string): void {
    this.emit('resolveMemberStatus', {
      status: ProcessingStatus.InProgress,
      message,
    });
  }
}

function matchesNameOrNamespace(
  pkg: InstalledSubscriberPackage['SubscriberPackage'],
  nameOrNamespace: string
): boolean {
  const value = nameOrNamespace.toLowerCase();
  return pkg?.Name?.toLowerCase() === value || pkg?.NamespacePrefix?.toLowerCase() === value;
}

function buildPackageMemberQueryString(entityDefs: EntityDefinition[], filter?: GarbageFilter): string {
  let queryString;
  if (filter?.includeOnly && filter.includeOnly.length > 0) {
    const keyPrefixFilter = QueryBuilder.buildParamListFilter(
      'SubjectKeyPrefix',
      entityDefs.map((def) => def.KeyPrefix)
    );
    queryString = QueryBuilder.sanitise(`${PACKAGE_MEMBER_BASE} 
        WHERE SubjectManageableState IN ('deprecatedEditable', 'deprecated')
        AND ${keyPrefixFilter}
        AND SubjectKeyPrefix NOT IN ('300')
        ORDER BY SubjectKeyPrefix`);
  } else {
    queryString = ALL_DEPRECATED_PACKAGE_MEMBERS;
  }
  return queryString;
}
