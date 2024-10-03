import fs from 'node:fs';
import yaml from 'js-yaml';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import MigrationPlan from './migrationPlan.js';

export default class MigrationPlanLoader {
  public static async loadPlan(filePath: string, org: Org): Promise<MigrationPlan> {
    const yamlContent: MigrationPlanData = yaml.load(fs.readFileSync(filePath, 'utf8')) as MigrationPlanData;
    const plan = new MigrationPlan(yamlContent, org);
    await plan.load();
    return plan;
  }
}
