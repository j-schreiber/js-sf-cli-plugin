/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { DeveloperNamedRecord, Package2Member } from '../../types/sfToolingApiTypes.js';
import { buildSubjectIdFilter, EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import QueryRunner from '../../common/utils/queryRunner.js';
import ToolingApiConnection from '../toolingApiConnection.js';

export class CustomMetadataRecord implements EntityDefinitionHandler {
  private readonly queryRunner: QueryRunner;
  private readonly apiConnection: ToolingApiConnection;

  public constructor(private readonly queryConnection: Connection) {
    this.queryRunner = new QueryRunner(this.queryConnection);
    this.apiConnection = ToolingApiConnection.getInstance(this.queryConnection);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    // members are already sorted - all have the same prefix
    if (packageMembers.length > 0) {
      const prefix = packageMembers[0].SubjectKeyPrefix;
      const customMetadataObjectDefs = await this.apiConnection.fetchObjectDefinitionsByKeyPrefix();
      const metadataObject = customMetadataObjectDefs.get(prefix);
      if (metadataObject === undefined) {
        return {
          metadataType: 'CustomMetadata',
          componentCount: garbageList.length,
          components: garbageList,
        };
      }
      const records = await this.fetchRecords(packageMembers, metadataObject.QualifiedApiName);
      packageMembers.forEach((member) => {
        const record = records.get(member.SubjectId);
        if (record !== undefined) {
          garbageList.push(
            new PackageGarbage(member, record.DeveloperName, `${metadataObject.DeveloperName}.${record.DeveloperName}`)
          );
        }
      });
    }
    return {
      metadataType: 'CustomMetadata',
      componentCount: garbageList.length,
      components: garbageList,
    };
  }

  private async fetchRecords(
    packageMembers: Package2Member[],
    objectName: string
  ): Promise<Map<string, DeveloperNamedRecord>> {
    const result = new Map<string, DeveloperNamedRecord>();
    const entityDefs = await this.queryRunner.fetchRecords<DeveloperNamedRecord>(
      `SELECT Id,DeveloperName FROM ${objectName} WHERE ${buildSubjectIdFilter(packageMembers)}`
    );
    entityDefs.forEach((def) => {
      result.set(def.Id, def);
    });
    return result;
  }
}
