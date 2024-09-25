import { Connection } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import { MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import ValidationResult from './validationResult.js';

// const msgs: Messages = Messages.loadMessages('sfdami', 'sfdami.export');

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: MigrationPlanData) {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData));
    });
  }

  public getName(): string {
    return `My name is: ${this.data.name}`;
  }

  public getObjects(): MigrationPlanObject[] {
    return this.objects;
  }

  public selfCheck(): ValidationResult {
    const res: ValidationResult = new ValidationResult();
    res.infos.push(`Found ${this.objects.length} objects.`);
    this.getObjects().forEach((planObject) => {
      if (!planObject.selfCheck()) {
        res.errors.push(`Error validating plan object ${this.data.name} at ${planObject.data.objectName}`);
      }
    });
    return res;
  }

  public async retrieveRecords(con: Connection): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    for (const planObject of this.getObjects()) {
      // eslint-disable-next-line no-await-in-loop
      const objectResults = await planObject.retrieveRecords(con);
      results.push(objectResults);
    }
    return results;
  }
}
