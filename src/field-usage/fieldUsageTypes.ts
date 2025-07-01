import { Optional } from '@jsforce/jsforce-node';

export type FieldUsageTable = {
  name: string;
  totalRecords: number;
  fields: FieldUsageStats[];
};

export type FieldUsageStats = {
  name: string;
  type: string;
  absolutePopulated: number;
  percentagePopulated: number;
  defaultValue?: Optional<string>;
};
