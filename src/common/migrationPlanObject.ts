import { MigrationPlanObjectData } from '../types/migrationPlanObjectData.js';

export default class MigrationPlanObject {
  public constructor(public data: MigrationPlanObjectData) {}

  public getName(): string {
    return `My object's name is: ${this.data.objectName}`;
  }
}
