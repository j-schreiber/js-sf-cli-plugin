import { Optional } from '@jsforce/jsforce-node';

export type FieldUsageTable = {
  name: string;
  totalRecords: number;
  analysedFields: FieldUsageStats[];
  skippedFields: FieldSkippedInfo[];
};

export type FieldUsageStats = {
  name: string;
  type: string;
  absolutePopulated: number;
  percentagePopulated: number;
  defaultValue?: Optional<string>;
};

export type FieldSkippedInfo = {
  name: string;
  type: string;
  reason: string;
};
