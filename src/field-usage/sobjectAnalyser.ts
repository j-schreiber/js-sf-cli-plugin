/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { EventEmitter } from 'node:events';
import { Connection, Messages } from '@salesforce/core';
import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';
import DescribeApi from '../common/metadata/describeApi.js';
import { DescribeRecordTypeResult, RecordTypeInfo, DescribeHistoryResult } from '../types/platformTypes.js';
import { FieldSkippedInfo, FieldUsageTable, SObjectAnalysisResult } from './fieldUsageTypes.js';
import FieldUsageAnalyser, { formatFieldType } from './fieldUsageAnalyser.js';

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

export type SObjectAnalyserOptions = {
  targetOrgConnection: Connection;
  describeResult: DescribeSObjectResult;
  recordTypeDescribes: Record<string, DescribeRecordTypeResult>;
  historyDescribeResult?: DescribeHistoryResult;
};

export default class SObjectAnalyser extends EventEmitter {
  private readonly fields: { [fieldName: string]: Field };
  private readonly hasRecordTypes: boolean;
  private readonly targetOrgConnection: Connection;
  private readonly describeResult: DescribeSObjectResult;
  private readonly recordTypeDescribes: Record<string, DescribeRecordTypeResult>;
  private readonly historyDescribeResult?: DescribeHistoryResult;

  private constructor(options: SObjectAnalyserOptions) {
    super();
    this.targetOrgConnection = options.targetOrgConnection;
    this.describeResult = options.describeResult;
    this.historyDescribeResult = options.historyDescribeResult;
    this.fields = mapFields(options.describeResult);
    this.hasRecordTypes = options.describeResult.recordTypeInfos?.length > 0 && this.fields.RecordTypeId !== undefined;
    this.recordTypeDescribes = options.recordTypeDescribes;
  }

  public static async create(targetOrgConnection: Connection, sobjectName: string): Promise<SObjectAnalyser> {
    const describeApi = new DescribeApi(targetOrgConnection);
    const describeResult = await describeApi.describeSObject(sobjectName);
    const recordTypeDescribes = await describeApi.resolveRecordTypes(describeResult);
    const historyDescribeResult = await describeApi.resolveHistoryRelationship(describeResult);
    return new SObjectAnalyser({ targetOrgConnection, describeResult, historyDescribeResult, recordTypeDescribes });
  }

  // PUBLIC API

  public async analyseFieldUsage(options?: FieldUsageOptions): Promise<SObjectAnalysisResult> {
    const { analysedFields, ignoredFields } = filterFields(this.describeResult.fields, options);
    this.emit('describeSuccess', {
      fieldCount: analysedFields.length,
      skippedFieldsCount: ignoredFields.length,
      recordTypesCount: this.describeResult.recordTypeInfos?.length ?? 1,
    });
    const totalRecords = await this.getTotalCount();
    this.emit('totalRecordsRetrieve', { totalRecords });
    const recordTypesResult: SObjectAnalysisResult = { recordTypes: {}, totalRecords };
    const fieldAnalyserConfig = {
      targetOrgConnection: this.targetOrgConnection,
      fields: analysedFields,
      describeResult: this.describeResult,
      historyDescribe: this.historyDescribeResult,
    };
    if (options?.segmentRecordTypes && this.hasRecordTypes) {
      for (const recordType of this.describeResult.recordTypeInfos as RecordTypeInfo[]) {
        const fsAnalyser = new FieldUsageAnalyser({
          ...fieldAnalyserConfig,
          recordType,
          recordTypeDescribe: this.recordTypeDescribes[recordType.recordTypeId],
        });
        // eslint-disable-next-line no-await-in-loop
        const table = await fsAnalyser.run({
          checkDefaults: options?.checkDefaultValues ?? false,
          checkHistory: options?.checkHistory ?? false,
        });
        table.skippedFields = ignoredFields;
        recordTypesResult.recordTypes[recordType.developerName] = table as FieldUsageTable;
      }
    } else {
      const fsAnalyser = new FieldUsageAnalyser(fieldAnalyserConfig);
      const table = await fsAnalyser.run({
        checkDefaults: options?.checkDefaultValues ?? false,
        checkHistory: options?.checkHistory ?? false,
      });
      table.skippedFields = ignoredFields;
      recordTypesResult.recordTypes.Master = table as FieldUsageTable;
    }
    return recordTypesResult;
  }

  // PRIVATE ZONE

  private async getTotalCount(): Promise<number> {
    const queryString = `SELECT COUNT() FROM ${this.describeResult.name}`;
    const result = await this.targetOrgConnection.query(queryString);
    return result.totalSize;
  }
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

function mapFields(describeResult: DescribeSObjectResult): Record<string, Field> {
  const result: Record<string, Field> = {};
  describeResult.fields.forEach((f) => (result[f.name] = f));
  return result;
}
