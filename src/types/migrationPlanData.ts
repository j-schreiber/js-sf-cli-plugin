import { MigrationPlanObjectData } from './migrationPlanObjectData.js';

export type MigrationPlanData = {
  name: string;
  objects: MigrationPlanObjectData[];
};
