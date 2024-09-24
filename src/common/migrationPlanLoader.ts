import fs from 'node:fs';
import yaml from 'js-yaml';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import MigrationPlan from './migrationPlan.js';

export default class MigrationPlanLoader {
  public static loadPlan(filePath: string): MigrationPlan {
    const yamlContent: MigrationPlanData = yaml.load(fs.readFileSync(filePath, 'utf8')) as MigrationPlanData;
    return new MigrationPlan(yamlContent);
  }
}
