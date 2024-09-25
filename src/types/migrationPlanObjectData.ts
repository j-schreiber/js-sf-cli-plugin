export type MigrationPlanObjectData = {
  objectName: string;
  queryFile?: string;
  queryString?: string;
};

export type MigrationPlanObjectQueryResult = {
  isSuccess: boolean;
  queryString: string;
  totalSize: number;
  files?: string[];
};
