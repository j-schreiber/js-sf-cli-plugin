export type MigrationPlanObjectData = {
  objectName: string;
  queryFile?: string;
  queryString?: string;
  query?: { fetchAllFields?: boolean; filter?: string; limit?: number };
};

export type MigrationPlanObjectQueryResult = {
  isSuccess: boolean;
  queryString: string;
  totalSize: number;
  files: string[];
};
