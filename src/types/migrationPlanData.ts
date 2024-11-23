import { ZMigrationPlanObjectDataType } from './migrationPlanObjectData.js';

export type MigrationPlanData = {
  name: string;
  objects: ZMigrationPlanObjectDataType[];
};
