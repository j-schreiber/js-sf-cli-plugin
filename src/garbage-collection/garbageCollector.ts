/* eslint-disable no-await-in-loop */
import EventEmitter from 'node:events';
import { Connection, Messages, SfError } from '@salesforce/core';
import QueryRunner from '../common/utils/queryRunner.js';
import { Package2, Package2Member } from '../types/sfToolingApiTypes.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import QueryBuilder from '../common/utils/queryBuilder.js';
import { GarbageFilter, PackageGarbageResult } from './packageGarbageTypes.js';
import { PACKAGE_2, PACKAGE_MEMBER_BASE, PACKAGE_MEMBER_QUERY } from './queries.js';
import ToolingApiConnection from './toolingApiConnection.js';
import GarbageManager from './garbageManager.js';
import PackageMemberFilter from './packageMemberFilter.js';

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
    const garbageMan = new GarbageManager(this.targetOrgConnection);
    this.parseInputs(filter);
    const members = await this.fetchPackageMembers2(filter);
    await this.resolveSubscriberPackage(members);
    await garbageMan.pushPackageMembers(members);
    // unsupported types?
    // not implemented types?
    return garbageMan.format();
  }

  //      PRIVATE ZONE

  private parseInputs(filter?: GarbageFilter): void {
    if (filter?.packages && filter.packages.length > 0 && !this.devhubConnection) {
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
      } as CommandStatusEvent);
    }
    if (filter?.includeOnly && filter.includeOnly.length > 0) {
      this.emit('resolveMemberStatus', {
        status: ProcessingStatus.InProgress,
        message: messages.getMessage('infos.metadata-filter-active', [filter.includeOnly.join(',')]),
      } as CommandStatusEvent);
    }
  }

  private async fetchPackageMembers2(filter?: GarbageFilter): Promise<Package2Member[]> {
    // why not only filter package members of "white-listed" entity types?
    // would make the "ignored types" thing entirely optional & increase performance
    const memberFilter = new PackageMemberFilter(
      await this.fetchSubscriberPackageVersions(filter?.packages),
      await this.toolingApiCache.resolveEntityDefinitionNames(filter?.includeOnly)
    );
    const packageMembers = await this.toolingObjectsRunner.fetchRecords<Package2Member>(PACKAGE_MEMBER_QUERY);
    packageMembers.push(...(await this.buildFlowPackageMembers()));
    return packageMembers.filter((member) => memberFilter.isAllowed(member));
  }

  private async buildFlowPackageMembers(): Promise<Package2Member[]> {
    const packagedFlowDefinitions = await this.toolingObjectsRunner.fetchRecords<Package2Member>(
      QueryBuilder.sanitise(`${PACKAGE_MEMBER_BASE} WHERE SubjectKeyPrefix = '300'`)
    );
    const packageMembers: Package2Member[] = [];
    packagedFlowDefinitions.forEach((flowDefMember) => {
      packageMembers.push(flowDefMember);
    });
    return packageMembers;
  }

  private async fetchSubscriberPackageVersions(packageIds?: string[]): Promise<Package2[]> {
    if (!packageIds || packageIds.length === 0) {
      return [];
    }
    const package2s = await this.devhubQueryRunner!.fetchRecords<Package2>(
      `${PACKAGE_2} WHERE ${QueryBuilder.buildParamListFilter('Id', packageIds)}`
    );
    package2s.forEach((p2) => {
      this.emitResolveStatus(`Resolved ${p2.Id} (Package2) to ${p2.SubscriberPackageId} (SubscriberPackage)`);
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
    } as CommandStatusEvent);
  }
}
