import fs from 'node:fs';
import { Org } from '@salesforce/core';
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

  public async retrieveRecords(org: Org, exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    // TODO: Find a way to use standard CLI logger
    process.stdout.write(`Starting retrieval of ${this.data.objectName}\n`);
    const queryResult = await org.getConnection().autoFetchQuery(this.getQueryString());
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: queryResult.done,
      queryString: this.getQueryString(),
      totalSize: queryResult.records.length,
      files: [],
    };
    let isDone = queryResult.done;
    let nextRecordsUrl = queryResult.nextRecordsUrl;
    let incrementer = 1;
    result.files.push(this.writeResultsToFile(queryResult.records, exportPath, incrementer));
    while (!isDone) {
      incrementer++;
      process.stdout.write('Fetching more...\n');
      // eslint-disable-next-line no-await-in-loop
      const moreResults = await org.getConnection().queryMore(nextRecordsUrl as string);
      isDone = moreResults.done;
      nextRecordsUrl = moreResults.nextRecordsUrl;
      result.files.push(this.writeResultsToFile(moreResults.records, exportPath, incrementer));
      result.totalSize += moreResults.records.length;
      process.stdout.write(`Retrieved ${moreResults.records.length} records.\n`);
    }
    process.stdout.write(`Successfully retrieved total of ${result.totalSize} records.\n`);
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

  private writeResultsToFile(queryRecords: unknown, exportPath: string, incrementer: number): string {
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    const fullFilePath = `${exportPath}/${this.data.objectName}/${incrementer}.json`;
    fs.writeFileSync(fullFilePath, JSON.stringify({ records: queryRecords }, null, 2));
    return fullFilePath;
  }

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
