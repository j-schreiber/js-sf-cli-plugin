/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { EventEmitter } from 'node:events';
import { Connection } from '@salesforce/core';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { FieldUsageStats, FieldUsageTable } from './fieldUsageTypes.js';

export type FieldUsageOptions = {
  customFieldsOnly?: boolean;
  excludeFormulaFields?: boolean;
};

export const INCLUDED_FIELD_TYPES = [
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
  private describeResult!: DescribeSObjectResult;

  private constructor(private readonly targetOrgConnection: Connection) {
    super();
    this.describeCache = new DescribeApi(this.targetOrgConnection);
  }

  public static async init(targetOrgConnection: Connection, sobjectName: string): Promise<SObjectAnalyser> {
    const newObj = new SObjectAnalyser(targetOrgConnection);
    newObj.describeResult = await newObj.describeCache.describeSObject(sobjectName);
    return newObj;
  }

  public async analyseFieldUsage(options?: FieldUsageOptions): Promise<FieldUsageTable> {
    const fieldsToAnalyse = filterFields(this.describeResult.fields, options);
    this.emit('describeSuccess', { fieldCount: fieldsToAnalyse.length });
    const totalCount = await this.getTotalCount();
    this.emit('totalRecordsRetrieve', { totalCount });
    const usageTable: FieldUsageTable = { name: this.describeResult.name, totalRecords: totalCount, fields: [] };
    if (!totalCount || totalCount === 0) {
      return usageTable;
    }
    const fieldStats: Array<Promise<FieldUsageStats>> = [];
    for (const field of fieldsToAnalyse) {
      fieldStats.push(this.getFieldUsageStats(totalCount, field));
    }
    usageTable.fields = await Promise.all(fieldStats);
    return formatTable(usageTable);
  }

  private async getTotalCount(): Promise<number> {
    const queryString = `SELECT COUNT(Id) FROM ${this.describeResult.name}`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }

  private async getPopulatedFieldCount(field: Field): Promise<number> {
    const queryString = `SELECT COUNT(Id) FROM ${this.describeResult.name} WHERE ${field.name} != NULL`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }

  private async getFieldUsageStats(totalCount: number, field: Field): Promise<FieldUsageStats> {
    const fieldsPopulatedCount = await this.getPopulatedFieldCount(field);
    return {
      name: field.name,
      type: field.calculated ? `formula (${field.type})` : field.type,
      absolutePopulated: fieldsPopulatedCount,
      percentagePopulated: fieldsPopulatedCount / totalCount,
    };
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
      ((field.custom && options?.customFieldsOnly) || !options?.customFieldsOnly) &&
      ((!field.calculated && options?.excludeFormulaFields) || !options?.excludeFormulaFields) &&
      INCLUDED_FIELD_TYPES.includes(field.type) &&
      field.filterable
  );
}
