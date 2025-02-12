import fs from 'node:fs';
import yaml from 'js-yaml';
import { Connection, SfError } from '@salesforce/core';
import { ZMigrationPlan, ZMigrationPlanType } from '../types/migrationPlanObjectData.js';
import MigrationPlan from './migrationPlan.js';

export default class MigrationPlanLoader {
  public static async loadPlan(filePath: string, sourcecon: Connection): Promise<MigrationPlan> {
    const yamlContent = yaml.load(fs.readFileSync(filePath, 'utf8'));
    const planData = ZMigrationPlan.parse(yamlContent);
    this.assertVariableExports(planData);
    const plan = new MigrationPlan(planData, sourcecon);
    await plan.load();
    return plan;
  }

  private static assertVariableExports(plan: ZMigrationPlanType): void {
    const exportedVariables: string[] = [];
    plan.objects.forEach((objectDef) => {
      if (objectDef.query?.bind) {
        if (!exportedVariables.includes(objectDef.query.bind.variable)) {
          throw new SfError(
            `${objectDef.objectName} references a parent bind that was not defined: ${objectDef.query.bind.variable}`,
            'InvalidPlanFileSyntax'
          );
        }
      }
      if (objectDef.exports) {
        Object.values(objectDef.exports).forEach((exportedVars) => exportedVariables.push(exportedVars));
      }
    });
  }
}
