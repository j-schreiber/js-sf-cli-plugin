/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { EventEmitter } from 'node:events';
import { Connection, Messages } from '@salesforce/core';
import { DescribeSObjectResult, Field, Optional } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { FieldSkippedInfo, FieldUsageStats, FieldUsageTable } from './fieldUsageTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'sobjectanalyser');

export type FieldUsageOptions = {
  customFieldsOnly?: boolean;
  excludeFormulaFields?: boolean;
  checkDefaultValues?: boolean;
  checkHistory?: boolean;
  segmentRecordTypes?: boolean;
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
  'time',
  'boolean',
  'phone',
  'email',
  'url',
  'int',
  'double',
  'currency',
  'percent',
];

export default class SObjectAnalyser extends EventEmitter {
  private historyRelationship?: ChildRelationship;
  private historyEnabled: boolean;

  private constructor(
    private readonly targetOrgConnection: Connection,
    private readonly describeResult: DescribeSObjectResult
  ) {
    super();
    this.historyRelationship = getHistoryRelationship(this.describeResult);
    this.historyEnabled = this.historyRelationship !== undefined;
  }

  public static async create(targetOrgConnection: Connection, sobjectName: string): Promise<SObjectAnalyser> {
    const describeApi = new DescribeApi(targetOrgConnection);
    const describeResult = await describeApi.describeSObject(sobjectName);
    const newObj = new SObjectAnalyser(targetOrgConnection, describeResult);
    return newObj;
  }

  // PUBLIC API

  public async analyseFieldUsage(options?: FieldUsageOptions): Promise<Record<string, FieldUsageTable>> {
    const { analysedFields, ignoredFields } = filterFields(this.describeResult.fields, options);
    this.emit('describeSuccess', {
      fieldCount: analysedFields.length,
      skippedFieldsCount: ignoredFields.length,
      recordTypesCount: this.describeResult.recordTypeInfos?.length ?? 1,
    });
    const totalCount = await this.getTotalCount();
    this.emit('totalRecordsRetrieve', { totalCount });
    const usageTable: FieldUsageTable = {
      totalRecords: totalCount,
      analysedFields: [],
      skippedFields: [],
    };
    if (!totalCount || totalCount === 0) {
      return { Master: usageTable };
    }
    const fieldStats: Array<Promise<FieldUsageStats>> = [];
    for (const field of analysedFields) {
      fieldStats.push(this.getFieldUsageStats(totalCount, field, options));
    }
    usageTable.analysedFields = await Promise.all(fieldStats);
    usageTable.skippedFields = ignoredFields;
    return { Master: formatTable(usageTable) };
  }

  // PRIVATE ZONE

  private async getTotalCount(): Promise<number> {
    const queryString = `SELECT COUNT(Id) FROM ${this.describeResult.name}`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }

  private async getPopulatedFieldCount(field: Field, checkDefaults?: boolean): Promise<number> {
    let queryString = `SELECT COUNT(Id) FROM ${this.describeResult.name} WHERE ${field.name} != NULL`;
    if (checkDefaults && field.defaultValue != null) {
      queryString +=
        field.type === 'boolean'
          ? ` AND ${field.name} != ${field.defaultValue}`
          : ` AND ${field.name} != '${field.defaultValue}'`;
    }
    const result = await this.targetOrgConnection.query(queryString);
    return result.records[0]['expr0'] as number;
  }

  private async getFieldUsageStats(
    totalCount: number,
    field: Field,
    options?: FieldUsageOptions
  ): Promise<FieldUsageStats> {
    const fieldsPopulatedCount = await this.getPopulatedFieldCount(field, options?.checkDefaultValues);
    const baseStats = {
      name: field.name,
      type: formatFieldType(field),
      absolutePopulated: fieldsPopulatedCount,
      percentagePopulated: fieldsPopulatedCount / totalCount,
      ...(options?.checkDefaultValues && { defaultValue: field.defaultValue }),
    };
    if (options?.checkHistory && this.historyEnabled) {
      const fieldHistoryStats = await this.getFieldHistoryStats(field);
      return {
        ...baseStats,
        ...fieldHistoryStats,
      };
    }
    return baseStats;
  }

  private async getFieldHistoryStats(field: Field): Promise<{ histories?: number; lastUpdated?: string }> {
    const queryString = `SELECT COUNT(Id),MAX(CreatedDate) FROM ${
      this.historyRelationship!.childSObject
    } WHERE Field = '${field.name}'`;
    const result = await this.targetOrgConnection.query(queryString);
    return { histories: result.records[0]['expr0'] as number, lastUpdated: result.records[0]['expr1'] as string };
  }
}

type ChildRelationship = {
  cascadeDelete: boolean;
  childSObject: string;
  deprecatedAndHidden: boolean;
  field: string;
  junctionIdListNames: string[];
  junctionReferenceTo: string[];
  relationshipName: Optional<string>;
  restrictedDelete: boolean;
};

function formatTable(table: FieldUsageTable): FieldUsageTable {
  table.analysedFields.sort((a, b) => a.percentagePopulated - b.percentagePopulated);
  return table;
}

function filterFields(
  fields: Field[],
  options?: FieldUsageOptions
): { analysedFields: Field[]; ignoredFields: FieldSkippedInfo[] } {
  const analysedFields: Field[] = [];
  const ignoredFields: FieldSkippedInfo[] = [];
  for (const field of fields) {
    if (!((field.custom && options?.customFieldsOnly) || !options?.customFieldsOnly)) {
      ignoredFields.push({
        name: field.name,
        type: formatFieldType(field),
        reason: messages.getMessage('info.not-a-custom-field'),
      });
      continue;
    }
    if (!((!field.calculated && options?.excludeFormulaFields) || !options?.excludeFormulaFields)) {
      ignoredFields.push({
        name: field.name,
        type: formatFieldType(field),
        reason: messages.getMessage('info.is-calculated'),
      });
      continue;
    }
    if (!INCLUDED_FIELD_TYPES.includes(field.type)) {
      ignoredFields.push({
        name: field.name,
        type: formatFieldType(field),
        reason: messages.getMessage('info.type-not-supported'),
      });
      continue;
    }
    if (!field.filterable) {
      ignoredFields.push({
        name: field.name,
        type: formatFieldType(field),
        reason: messages.getMessage('info.not-filterable'),
      });
      continue;
    }
    analysedFields.push(field);
  }
  return { analysedFields, ignoredFields };
}

function formatFieldType(field: Field): string {
  return field.calculated ? `formula (${field.type})` : field.type;
}

function getHistoryRelationship(describeResult: DescribeSObjectResult): ChildRelationship | undefined {
  if (describeResult.childRelationships?.length > 0) {
    for (const cr of describeResult.childRelationships) {
      if (cr.relationshipName === 'Histories') {
        return cr;
      }
    }
  }
  return undefined;
}
