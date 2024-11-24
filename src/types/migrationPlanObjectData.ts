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

const ZParentBind = z.object({ field: z.string(), variable: z.string() });

const ZQueryObject = z.object({
  fetchAllFields: z.boolean(),
  limit: z.number().optional(),
  filter: z.string().optional(),
  parent: ZParentBind.optional(),
});

const ZMigrationPlanObjectData = z.object({
  objectName: z.string(),
  queryFile: z.string().optional(),
  queryString: z.string().optional(),
  isToolingObject: z.boolean().optional(),
  exportIds: z.string().optional(),
  query: ZQueryObject.optional(),
});

export type ZParentBindType = z.infer<typeof ZParentBind>;
export type ZQueryObjectType = z.infer<typeof ZQueryObject>;
export type ZMigrationPlanObjectDataType = z.infer<typeof ZMigrationPlanObjectData>;
