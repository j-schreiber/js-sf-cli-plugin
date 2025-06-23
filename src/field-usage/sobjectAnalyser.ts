import { EventEmitter } from 'node:events';
import { Connection } from '@salesforce/core';
import { Field } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { FieldUsageTable } from './fieldUsageTypes.js';

export type FieldUsageOptions = {
  customFieldsOnly: boolean;
};

const WHITELISTED_FIELD_TYPES = [
  'textarea',
  'string',
  'double',
  'picklist',
  'id',
  'reference',
  'date',
  'datetime',
  'boolean',
];

export default class SObjectAnalyser extends EventEmitter {
  private readonly describeCache: DescribeApi;

  public constructor(private readonly targetOrgConnection: Connection) {
    super();
    this.describeCache = new DescribeApi(this.targetOrgConnection);
  }

  public async analyseFieldUsage(sobjectName: string, options?: FieldUsageOptions): Promise<FieldUsageTable> {
    const sobjectDescribe = await this.describeCache.describeSObject(sobjectName);
    const fieldsToAnalyse = filterFields(sobjectDescribe.fields, options);
    this.emit('describeSuccess', { fieldCount: fieldsToAnalyse.length });
    const totalCount = await getTotalCount(sobjectDescribe.name, this.targetOrgConnection);
    this.emit('totalRecordsRetrieve', { totalCount });
    const usageTable: FieldUsageTable = { name: sobjectDescribe.name, totalRecords: totalCount, fields: [] };
    if (!totalCount || totalCount === 0) {
      return usageTable;
    }
    for (const field of fieldsToAnalyse) {
      this.emit('fieldAnalysis', {
        fieldName: field.name,
        fieldCounter: `${fieldsToAnalyse.indexOf(field) + 1} of ${fieldsToAnalyse.length}`,
      });
      // eslint-disable-next-line no-await-in-loop
      const fieldsPopulatedCount = await getPopulatedFieldCount(sobjectDescribe.name, field, this.targetOrgConnection);
      usageTable.fields.push({
        name: field.name,
        type: field.type,
        absolutePopulated: fieldsPopulatedCount,
        percentagePopulated: fieldsPopulatedCount / totalCount,
        percentFormatted: (fieldsPopulatedCount / totalCount).toLocaleString('de', {
          style: 'percent',
          minimumFractionDigits: 2,
        }),
      });
    }
    return formatTable(usageTable);
  }
}

function formatTable(table: FieldUsageTable): FieldUsageTable {
  table.fields.sort((a, b) => a.percentagePopulated - b.percentagePopulated);
  return table;
}

function filterFields(fields: Field[], options?: FieldUsageOptions): Field[] {
  return fields.filter(
    (field) =>
      ((field.custom && options?.customFieldsOnly) ?? !options?.customFieldsOnly) &&
      WHITELISTED_FIELD_TYPES.includes(field.type) &&
      field.filterable
  );
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
