import fs from 'node:fs';
import yaml from 'js-yaml';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import MigrationPlan from './migrationPlan.js';

export default class MigrationPlanLoader {
  public static loadPlan(filePath: string, org: Org): MigrationPlan {
    const yamlContent: MigrationPlanData = yaml.load(fs.readFileSync(filePath, 'utf8')) as MigrationPlanData;
    return new MigrationPlan(yamlContent, org);
  }
}
