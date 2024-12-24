/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { FlowVersionDefinition, Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';
import { OBSOLETE_FLOWS } from '../queries.js';

export class OutdatedFlowVersions implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;

  public constructor(private queryConnection: Connection) {
    this.queryRunner = new QueryRunner(this.queryConnection.tooling);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const outdatedVersions = await this.fetchOutdatedFlowVersions();
    packageMembers.forEach((packageMember) => {
      const versions = outdatedVersions.get(packageMember.SubjectId);
      if (versions && versions.length > 0) {
        versions.forEach((flowVersion) => {
          garbageList.push({
            developerName: `${flowVersion.Definition.DeveloperName}-${flowVersion.VersionNumber}`,
            fullyQualifiedName: `${flowVersion.Definition.DeveloperName}-${flowVersion.VersionNumber}`,
            subjectId: flowVersion.Id,
          });
        });
      }
    });
    return { metadataType: 'Flow', componentCount: garbageList.length, components: garbageList };
  }

  private async fetchOutdatedFlowVersions(): Promise<Map<string, FlowVersionDefinition[]>> {
    const versionsMap = new Map<string, FlowVersionDefinition[]>();
    const outdatedVersions = await this.queryRunner.fetchRecords<FlowVersionDefinition>(OBSOLETE_FLOWS);
    outdatedVersions.forEach((ver) => {
      if (!versionsMap.has(ver.DefinitionId)) {
        versionsMap.set(ver.DefinitionId, new Array<FlowVersionDefinition>());
      }
      versionsMap.get(ver.DefinitionId)?.push(ver);
    });
    return versionsMap;
  }
}
