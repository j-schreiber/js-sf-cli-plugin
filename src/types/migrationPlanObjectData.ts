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
  parent: z.object({ field: z.string(), bind: z.string() }).optional(),
});

export type ZQueryObjectType = z.infer<typeof ZQueryObject>;
