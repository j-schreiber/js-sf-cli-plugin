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
    const exportedIds: string[] = [];
    plan.objects.forEach((objectDef) => {
      if (objectDef.query?.parent) {
        if (!exportedIds.includes(objectDef.query.parent.variable)) {
          throw new SfError(
            `${objectDef.objectName} references a parent bind that was not defined: ${objectDef.query.parent.variable}`,
            'InvalidPlanFileSyntax'
          );
        }
      }
      if (objectDef.exportIds) {
        if (exportedIds.includes(objectDef.exportIds)) {
          throw new SfError(
            `${objectDef.objectName} exports a bind variable that was already defined: ${objectDef.exportIds}`,
            'InvalidPlanFileSyntax'
          );
        }
        exportedIds.push(objectDef.exportIds);
      }
    });
  }
}
