import { EventEmitter } from 'node:events';
import { Connection } from '@salesforce/core';
import { Field } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { FieldUsageTable } from './fieldUsageTypes.js';

export type FieldUsageOptions = {
  customFieldsOnly: boolean;
};

const INCLUDED_FIELD_TYPES = [
  'textarea',
  'string',
  'multipicklist',
  'picklist',
  'id',
  'reference',
  'date',
  'datetime',
  'boolean',
  'phone',
  'email',
  'url',
  'int',
  'double',
  'currency',
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
    const totalCount = await this.getTotalCount(sobjectDescribe.name);
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
      const fieldsPopulatedCount = await this.getPopulatedFieldCount(sobjectDescribe.name, field);
      usageTable.fields.push({
        name: field.name,
        type: field.type,
        absolutePopulated: fieldsPopulatedCount,
        percentagePopulated: fieldsPopulatedCount / totalCount,
      });
    }
    return formatTable(usageTable);
  }

  private async getTotalCount(sobjectName: string): Promise<number> {
    const queryString = `SELECT COUNT(Id) FROM ${sobjectName}`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }

  private async getPopulatedFieldCount(sobjectName: string, field: Field): Promise<number> {
    const queryString = `SELECT COUNT(Id) FROM ${sobjectName} WHERE ${field.name} != NULL`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }
}

function formatTable(table: FieldUsageTable): FieldUsageTable {
  table.fields.sort((a, b) => a.percentagePopulated - b.percentagePopulated);
  return table;
}

function filterFields(fields: Field[], options?: FieldUsageOptions): Field[] {
  return fields.filter(
    (field) =>
      // nullish-coalescing actually changes behavior - check tests
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      ((field.custom && options?.customFieldsOnly) || !options?.customFieldsOnly) &&
      INCLUDED_FIELD_TYPES.includes(field.type) &&
      field.filterable
  );
}
