import { Optional } from '@jsforce/jsforce-node';

export type SObjectAnalysisResult = {
  /** Map of record types (by developer name) and scoped analysis results */
  recordTypes: Record<string, FieldUsageTable>;

  /** Total number of records for the entire sobject */
  totalRecords: number;
};

/**
 * Usage stats for a record type. All analysed and skipped fields
 * and additional information about the record type.
 */
export type FieldUsageTable = {
  totalRecords: number;
  isActive: boolean;
  analysedFields: FieldUsageStats[];
  skippedFields: FieldSkippedInfo[];
};

export type FieldUsageStats = {
  name: string;
  type: string;
  absolutePopulated: number;
  percentagePopulated: number;
  defaultValue?: Optional<string>;
  histories?: number;
  lastUpdated?: string;
};

export type FieldSkippedInfo = {
  name: string;
  type: string;
  reason: string;
};
