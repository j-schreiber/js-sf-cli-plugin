import { MigrationPlanData } from '../types/migrationPlanData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import ValidationResult from './validationResult.js';

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: MigrationPlanData) {}

  public getObjects(): MigrationPlanObject[] {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData));
    });
    return this.objects;
  }

  public getName(): string {
    return `My name is: ${this.data.name}`;
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
}
