import { z } from 'zod';

export type MigrationPlanObjectData = {
  objectName: string;
  queryFile?: string;
  queryString?: string;
  isToolingObject?: boolean;
  query?: ZQueryObjectType;
};

export type MigrationPlanObjectQueryResult = {
  isSuccess: boolean;
  queryString: string;
  totalSize: number;
  files: string[];
};

const ZQueryObject = z.object({
  fetchAllFields: z.boolean(),
  limit: z.number().optional(),
  filter: z.string().optional(),
  parent: z.record(z.string()).optional(),
});

const ZMigrationPlanObjectData = z.object({
  objectName: z.string(),
  queryFile: z.string().optional(),
  queryString: z.string().optional(),
  isToolingObject: z.boolean().optional(),
  exportIds: z.string().optional(),
  query: ZQueryObject.optional(),
});

export type ZQueryObjectType = z.infer<typeof ZQueryObject>;
export type ZMigrationPlanObjectDataType = z.infer<typeof ZMigrationPlanObjectData>;
