import { EventEmitter } from 'node:events';
import { Connection } from '@salesforce/core';
import { Field } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { FieldUsageTable } from './fieldUsageTypes.js';

export type FieldUsageOptions = {
  customFieldsOnly: boolean;
};

export default class SObjectAnalyser extends EventEmitter {
  private readonly describeCache: DescribeApi;

  public constructor(private readonly targetOrgConnection: Connection) {
    super();
    this.describeCache = new DescribeApi(this.targetOrgConnection);
  }

  public async analyseFieldUsage(sobjectName: string, options?: FieldUsageOptions): Promise<FieldUsageTable> {
    const sobjectDescribe = await this.describeCache.describeSObject(sobjectName);
    const totalCount = await getTotalCount(sobjectDescribe.name, this.targetOrgConnection);
    const usageTable: FieldUsageTable = { name: sobjectDescribe.name, totalRecords: totalCount, fields: [] };
    if (totalCount && totalCount > 0) {
      for (const field of sobjectDescribe.fields) {
        if (!options?.customFieldsOnly && !field.custom) {
          continue;
        }
        // map for fields of filterable and types first?
        if (
          field.filterable &&
          ['textarea', 'string', 'double', 'picklist', 'id', 'reference', 'date', 'datetime'].includes(field.type)
        ) {
          // eslint-disable-next-line no-await-in-loop
          const fieldsPopulatedCount = await getPopulatedFieldCount(
            sobjectDescribe.name,
            field,
            this.targetOrgConnection
          );
          usageTable.fields.push({
            name: field.name,
            type: field.type,
            absolutePopulated: fieldsPopulatedCount,
            percentagePopulated: (fieldsPopulatedCount / totalCount).toLocaleString('de', {
              style: 'percent',
              minimumFractionDigits: 2,
            }),
          });
        }
      }
    }
    return usageTable;
  }
}

async function getTotalCount(sobjectName: string, conn: Connection): Promise<number> {
  const queryString = `SELECT COUNT(Id) FROM ${sobjectName}`;
  const result = await conn.query(queryString);
  return result.records[0]['expr0'] as number;
}

async function getPopulatedFieldCount(sobjectName: string, field: Field, conn: Connection): Promise<number> {
  const queryString = `SELECT COUNT(Id) FROM ${sobjectName} WHERE ${field.name} != NULL`;
  const result = await conn.query(queryString);
  return result.records[0]['expr0'] as number;
}
