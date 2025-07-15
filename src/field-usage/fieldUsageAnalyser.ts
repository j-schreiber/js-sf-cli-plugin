import { Connection, DescribeSObjectResult, Field, Optional } from '@jsforce/jsforce-node';
import { DescribeHistoryResult, RecordTypeInfo } from '../types/platformTypes.js';
import { DescribeRecordTypeResult, RecordTypePicklist } from '../types/platformTypes.js';
import { FieldUsageStats, FieldUsageTable } from './fieldUsageTypes.js';

export type FieldUsageAnalyserOptions = {
  checkDefaults: boolean;
  checkHistory: boolean;
};

export type FieldUsageAnalyserConfig = {
  targetOrgConnection: Connection;
  fields: Field[];
  describeResult: DescribeSObjectResult;
  recordType?: RecordTypeInfo;
  recordTypeDescribe?: Optional<DescribeRecordTypeResult>;
  historyDescribe?: DescribeHistoryResult;
};

/**
 * Initialises an analyser that runs a series of queries against the target
 * org connection. If record type is empty, the entire sobject is analysed.
 * If it is set, only record of the particular record type are analysed.
 */
export default class FieldUsageAnalyser {
  public COUNT_FIELD_BASE_QUERY: string;
  public TOTAL_COUNT_BASE_QUERY: string;
  public COUNT_HISTORY_BASE_QUERY?: string;
  private historyRecordTypeId?: string;
  private readonly targetOrgConnection: Connection;
  private readonly fieldsToAnalyse: Field[];
  private readonly describeResult: DescribeSObjectResult;
  private readonly recordType?: RecordTypeExtension;
  private readonly isHistoryEnabled: boolean;

  public constructor(options: FieldUsageAnalyserConfig) {
    this.describeResult = options.describeResult;
    this.fieldsToAnalyse = options.fields;
    this.targetOrgConnection = options.targetOrgConnection;
    this.isHistoryEnabled = Boolean(options.historyDescribe);
    if (this.isHistoryEnabled) {
      this.COUNT_HISTORY_BASE_QUERY = buildHistoryQuery(options.historyDescribe!);
      this.historyRecordTypeId = buildRecordTypeFilterField(options.historyDescribe!);
    }
    if (options.recordType) {
      this.recordType = new RecordTypeExtension(options.recordType, options.recordTypeDescribe);
    }
    this.COUNT_FIELD_BASE_QUERY = `SELECT COUNT() FROM ${this.describeResult.name}`;
    this.TOTAL_COUNT_BASE_QUERY = `SELECT COUNT() FROM ${this.describeResult.name}`;
  }

  // PUBLIC API

  public async run(options: FieldUsageAnalyserOptions): Promise<Partial<FieldUsageTable>> {
    const totalCount = await this.getTotalCount();
    const partialFieldStats: Array<Promise<Partial<FieldUsageStats>>> = [];
    for (const field of this.fieldsToAnalyse) {
      let stats: Promise<Partial<FieldUsageStats>>;
      // always resolve field usage stats, but save the queries if
      // we already know the object is empty
      if (totalCount > 0) {
        stats = this.calculateUsageStats(field, options);
      } else {
        stats = Promise.resolve(this.createEmptyUsageStats(field, options));
      }
      partialFieldStats.push(stats);
    }
    const fieldStats: Array<Partial<FieldUsageStats>> = await Promise.all(partialFieldStats);
    const analysedFields = finaliseFieldUsageStats(fieldStats, totalCount);
    return { totalRecords: totalCount, analysedFields, isActive: this.recordType?.infos.active ?? true };
  }

  // PRIVATE ZONE

  private async getTotalCount(): Promise<number> {
    const queryString = this.recordType
      ? `${this.TOTAL_COUNT_BASE_QUERY} WHERE ${this.recordType.getFilterClause()}`
      : this.TOTAL_COUNT_BASE_QUERY;
    const result = await this.targetOrgConnection.query(queryString);
    return result.totalSize;
  }

  private createEmptyUsageStats(field: Field, options: FieldUsageAnalyserOptions): Partial<FieldUsageStats> {
    let base = {
      name: field.name,
      type: formatFieldType(field),
      absolutePopulated: 0,
    };
    if (options.checkDefaults) {
      base = { ...base, ...{ defaultValue: this.resolveFieldDefaultValue(field) } };
    }
    if (options.checkHistory && this.isHistoryEnabled) {
      const historyStats = { histories: 0, lastUpdated: undefined };
      return { ...base, ...historyStats };
    }
    return base;
  }

  private async calculateUsageStats(
    field: Field,
    options: FieldUsageAnalyserOptions
  ): Promise<Partial<FieldUsageStats>> {
    const fieldsPopulatedCount = await this.fetchPopulatedFieldCount(field, options);
    let base = {
      name: field.name,
      type: formatFieldType(field),
      absolutePopulated: fieldsPopulatedCount,
    };
    if (options.checkDefaults) {
      base = { ...base, ...{ defaultValue: this.resolveFieldDefaultValue(field) } };
    }
    if (options.checkHistory && this.isHistoryEnabled) {
      const historyStats = await this.fetchHistoryStats(field);
      return { ...base, ...historyStats };
    }
    return base;
  }

  private async fetchPopulatedFieldCount(field: Field, options: FieldUsageAnalyserOptions): Promise<number> {
    let queryString = this.fieldCountQuery(field);
    // need to re-visit how we check if a field has a default
    if (options.checkDefaults) {
      const fieldDefaultValue = this.resolveFieldDefaultValue(field);
      if (fieldDefaultValue) {
        queryString +=
          field.type === 'boolean'
            ? ` AND ${field.name} != ${fieldDefaultValue}`
            : ` AND ${field.name} != '${fieldDefaultValue}'`;
      }
    }
    const result = await this.targetOrgConnection.query(queryString);
    return result.totalSize;
  }

  private resolveFieldDefaultValue(field: Field): Optional<string> {
    // for all non-picklist fields, or if we don't evaluate record types, return
    // the global default
    if (!this.recordType || this.recordType?.infos.master || field.type !== 'picklist') {
      return field.defaultValue;
    }
    // only picklists are record type specific
    return this.recordType.getDefaultValue(field.name);
  }

  private async fetchHistoryStats(field: Field): Promise<{ histories: number; lastUpdated: string }> {
    const queryString = this.historyQuery(field);
    const result = await this.targetOrgConnection.query(queryString);
    return { histories: result.records[0]['expr0'] as number, lastUpdated: result.records[0]['expr1'] as string };
  }

  private fieldCountQuery(field: Field): string {
    if (this.recordType) {
      return `${this.COUNT_FIELD_BASE_QUERY} WHERE ${this.recordType.getFilterClause()} AND ${field.name} != NULL`;
    }
    // no record type is set
    return `${this.COUNT_FIELD_BASE_QUERY} WHERE ${field.name} != NULL`;
  }

  private historyQuery(field: Field): string {
    const baseQuery = `${this.COUNT_HISTORY_BASE_QUERY!} WHERE Field = '${field.name}'`;
    if (this.recordType && this.recordType.infos.developerName.toLocaleLowerCase() === 'master') {
      return `${baseQuery} AND (${this.historyRecordTypeId!} = '${this.recordType.infos.recordTypeId}' OR ${this
        .historyRecordTypeId!} = NULL)`;
    }
    if (this.recordType) {
      return `${baseQuery} AND ${this.historyRecordTypeId!} = '${this.recordType.infos.recordTypeId}'`;
    }
    return `${this.COUNT_HISTORY_BASE_QUERY!} WHERE Field = '${field.name}'`;
  }
}

function buildHistoryQuery(historyDescribe: DescribeHistoryResult): string {
  return `SELECT COUNT(Id),MAX(CreatedDate) FROM ${historyDescribe.relationship.childSObject}`;
}

function buildRecordTypeFilterField(historyDescribe: DescribeHistoryResult): string | undefined {
  const parentField = historyDescribe.describe.fields.find((f) => f.name === historyDescribe.relationship.field);
  if (parentField) {
    return `${parentField.relationshipName!}.RecordTypeId`;
  }
  return undefined;
}

function finaliseFieldUsageStats(stats: Array<Partial<FieldUsageStats>>, totalCount: number): FieldUsageStats[] {
  for (const stat of stats) {
    if (totalCount > 0) {
      stat.percentagePopulated = stat.absolutePopulated! / totalCount;
    } else {
      stat.percentagePopulated = 0;
    }
  }
  return sortStats(stats as FieldUsageStats[]);
}

function sortStats(analysedFields: FieldUsageStats[]): FieldUsageStats[] {
  analysedFields.sort((a, b) => a.percentagePopulated - b.percentagePopulated);
  return analysedFields;
}

export function formatFieldType(field: Field): string {
  return field.calculated ? `formula (${field.type})` : field.type;
}

class RecordTypeExtension {
  private picklistFields: Record<string, RecordTypePicklist> = {};
  private picklistDefaultValue: Record<string, string> = {};

  public constructor(
    public readonly infos: RecordTypeInfo,
    public readonly describe: Optional<DescribeRecordTypeResult>
  ) {
    if (this.describe) {
      this.describe.picklistValues.forEach((plv) => {
        this.picklistFields[plv.picklist] = plv;
        plv.values.forEach((val) => {
          if (val.default) {
            this.picklistDefaultValue[plv.picklist] = val.valueName!;
          }
        });
      });
    }
  }

  public getFilterClause(): string {
    if (this.infos.developerName.toLocaleLowerCase() === 'master') {
      return `(RecordTypeId = '${this.infos.recordTypeId}' OR RecordTypeId = NULL)`;
    }
    return `RecordTypeId = '${this.infos.recordTypeId}'`;
  }

  public getDefaultValue(fieldName: string): Optional<string> {
    return this.picklistDefaultValue[fieldName];
  }
}
