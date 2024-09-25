import fs from 'node:fs';
import { Connection } from '@salesforce/core';
import { MigrationPlanObjectData, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';

export default class MigrationPlanObject {
  public constructor(public data: MigrationPlanObjectData) {}

  //      PUBLIC API

  public getName(): string {
    return `My object's name is: ${this.data.objectName}`;
  }

  public selfCheck(): boolean {
    if (this.hasValidFile() && this.hasQueryString()) {
      return false;
    }
    if (!this.hasValidFile() && !this.hasQueryString()) {
      return false;
    }
    return true;
  }

  public async retrieveRecords(con: Connection): Promise<MigrationPlanObjectQueryResult> {
    // TODO: this is where we batch, if we receive to many records
    process.stdout.write(`Starting retrieval of ${this.data.objectName}\n`);
    const queryResult = await con.autoFetchQuery(this.getQueryString());
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: queryResult.done,
      queryString: this.getQueryString(),
      totalSize: queryResult.totalSize,
      files: ['test-file.json'],
    };
    process.stdout.write(`Successfully retrieved ${result.totalSize} records.\n`);
    return result;
  }

  public getQueryString(): string {
    if (this.hasQueryString()) {
      return String(this.data.queryString);
    } else {
      return this.loadQueryStringFromFile();
    }
  }

  //        PRIVATE

  private loadQueryStringFromFile(): string {
    const queryString = fs.readFileSync(this.data.queryFile as string, 'utf8');
    return queryString.trim();
  }

  private hasQueryString(): boolean {
    return Boolean(this.data.queryString && this.data.queryString.trim() !== '');
  }

  private hasValidFile(): boolean {
    if (this.data.queryFile && this.data.queryFile.trim() !== '') {
      return this.loadQueryStringFromFile() !== '' ? true : false;
    } else {
      return false;
    }
  }
}
