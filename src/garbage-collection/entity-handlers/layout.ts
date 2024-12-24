/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { NamedSObjectChildType, Package2Member } from '../../types/sfToolingApiTypes.js';
import { EntityDefinitionHandler, extractSubjectIds } from '../entityDefinitionHandler.js';
import { PackageGarbage, PackageGarbageContainer } from '../packageGarbageTypes.js';
import ToolingApiConnection from '../toolingApiConnection.js';
import QueryRunner from '../../common/utils/queryRunner.js';
import QueryBuilder from '../../common/utils/queryBuilder.js';

export class Layout implements EntityDefinitionHandler {
  private queryRunner: QueryRunner;
  private apiConnection: ToolingApiConnection;

  public constructor(private queryConnection: Connection) {
    this.apiConnection = ToolingApiConnection.getInstance(this.queryConnection);
    this.queryRunner = new QueryRunner(this.queryConnection.tooling);
  }

  public async resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer> {
    const garbageList: PackageGarbage[] = [];
    const objectsByDurableId = await this.apiConnection.fetchObjectDefinitionsByDurableId();
    const definitions = await this.fetchDefinitions(extractSubjectIds(packageMembers));
    packageMembers.forEach((member) => {
      const def = definitions.get(member.SubjectId);
      if (def) {
        // field belongs to a custom object (or custom metadata, platform event, etc)
        if (def.TableEnumOrId.startsWith('01I')) {
          const customObjDef = objectsByDurableId.get(def.TableEnumOrId.substring(0, 15));
          if (customObjDef) {
            garbageList.push({
              developerName: def.Name,
              fullyQualifiedName: `${customObjDef.QualifiedApiName}-${def.Name}`,
              subjectId: def.Id,
            });
          }
        } else {
          // must be a custom field to a standard object
          garbageList.push({
            developerName: def.Name,
            fullyQualifiedName: `${def.TableEnumOrId}-${def.Name}`,
            subjectId: def.Id,
          });
        }
      }
    });
    return { metadataType: 'Layout', componentCount: garbageList.length, components: garbageList };
  }

  private async fetchDefinitions(subjectIds: string[]): Promise<Map<string, NamedSObjectChildType>> {
    const childDefsMap = new Map<string, NamedSObjectChildType>();
    const entities = await this.queryRunner.fetchRecords<NamedSObjectChildType>(
      `SELECT Id,Name,TableEnumOrId FROM Layout WHERE ${QueryBuilder.buildParamListFilter('Id', subjectIds)}`
    );
    entities.forEach((childDef) => {
      childDefsMap.set(childDef.Id, childDef);
    });
    return childDefsMap;
  }
}
