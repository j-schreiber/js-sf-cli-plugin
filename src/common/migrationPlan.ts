import fs from 'node:fs';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import { MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import ValidationResult from './validationResult.js';

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: MigrationPlanData, public org: Org) {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData, org.getConnection()));
    });
  }

  public getName(): string {
    return this.data.name;
  }

  public getObjects(): MigrationPlanObject[] {
    return this.objects;
  }

  public selfCheck(): ValidationResult {
    const res: ValidationResult = new ValidationResult();
    res.infos.push(`Found ${this.objects.length} objects.`);
    this.getObjects().forEach((planObject) => {
      if (!planObject.selfCheck()) {
        res.errors.push(`Error validating plan object ${this.data.name} at ${planObject.getObjectName()}`);
      }
    });
    return res;
  }

  public async execute(): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    const exportPath: string = `./.sfdami/${this.org.getUsername() as string}/exports`;
    fs.rmSync(exportPath, { recursive: true, force: true });
    fs.mkdirSync(exportPath, { recursive: true });
    for (const planObject of this.getObjects()) {
      // eslint-disable-next-line no-await-in-loop
      const objectResults = await planObject.retrieveRecords(this.org, exportPath);
      results.push(objectResults);
    }
    return results;
  }
}
