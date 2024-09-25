import { MigrationPlanObjectData } from '../types/migrationPlanObjectData.js';

export default class MigrationPlanObject {
  public constructor(public data: MigrationPlanObjectData) {}

  public getName(): string {
    return `My object's name is: ${this.data.objectName}`;
  }

  public selfCheck(): boolean {
    const nonEmptyFile: boolean = Boolean(this.data.queryFile && this.data.queryFile.trim() !== '');
    const nonEmptyQueryString: boolean = Boolean(this.data.queryString && this.data.queryString.trim() !== '');
    if (nonEmptyFile && nonEmptyQueryString) {
      return false;
    }
    if (!nonEmptyFile && !nonEmptyQueryString) {
      return false;
    }
    return true;
  }
}
