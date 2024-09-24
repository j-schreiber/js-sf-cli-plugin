import { MigrationPlanData } from '../types/migrationPlanData.js';
import MigrationPlanObject from './migrationPlanObject.js';

export default class MigrationPlan {
  public constructor(public data: MigrationPlanData) {}

  public getObjects(): MigrationPlanObject[] {
    const objects: MigrationPlanObject[] = [];
    this.data.objects.forEach((objectData) => {
      objects.push(new MigrationPlanObject(objectData));
    });
    return objects;
  }

  public getName(): string {
    return `My name is: ${this.data.name}`;
  }
}
