import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection, Org } from '@salesforce/core';
import { MigrationPlanObjectData, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import DescribeApi from './metadata/describeApi.js';

export default class MigrationPlanObject {
  private describeResult?: DescribeSObjectResult;

  public constructor(private data: MigrationPlanObjectData, private conn: Connection) {}

  //      PUBLIC API

  public getObjectName(): string {
    return this.data.objectName;
  }

  public selfCheck(): boolean {
    if (Number(this.hasValidFile()) + Number(this.hasQueryString()) + Number(this.hasQueryConstructor()) === 1) {
      return true;
    }
    return false;
  }

  public async retrieveRecords(org: Org, exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    // TODO: Find a way to use standard CLI logger
    process.stdout.write(`Starting retrieval of ${this.data.objectName}\n`);
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    // fetchSize & autoFetch = true do not work with queryMore, 2000 already is the max number
    const queryString = await this.getQueryString();
    const queryResult = await org.getConnection().query(queryString);
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: queryResult.done,
      queryString,
      totalSize: queryResult.records.length,
      files: [],
    };
    let isDone = queryResult.done;
    let nextRecordsUrl = queryResult.nextRecordsUrl;
    let incrementer = 1;
    result.files.push(this.writeResultsToFile(queryResult.records, exportPath, incrementer));
    process.stdout.write(`Retrieved ${queryResult.records.length} records.\n`);
    while (!isDone) {
      incrementer++;
      // eslint-disable-next-line no-await-in-loop
      const moreResults = await org.getConnection().queryMore(nextRecordsUrl as string);
      isDone = moreResults.done;
      nextRecordsUrl = moreResults.nextRecordsUrl;
      result.files.push(this.writeResultsToFile(moreResults.records, exportPath, incrementer));
      result.totalSize += moreResults.records.length;
      process.stdout.write(`Retrieved ${moreResults.records.length} records.\n`);
    }
    process.stdout.write(`Completed query with total of ${result.totalSize} records.\n`);
    return result;
  }

  public async describeObject(): Promise<DescribeSObjectResult> {
    if (!this.describeResult) {
      const descApi: DescribeApi = new DescribeApi(this.conn);
      this.describeResult = await descApi.describeSObject(this.data.objectName);
    }
    return this.describeResult;
  }

  public async getQueryString(): Promise<string> {
    if (this.hasQueryString()) {
      return String(this.data.queryString);
    } else if (this.hasValidFile()) {
      return this.loadQueryStringFromFile();
    } else if (this.hasQueryConstructor()) {
      const query = await this.buildQuery();
      return query;
    } else {
      throw new Error(`No query defined for: ${this.data.objectName}`);
    }
  }

  //        PRIVATE

  private writeResultsToFile(queryRecords: unknown, exportPath: string, incrementer: number): string {
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

  private hasQueryConstructor(): boolean {
    return Boolean(this.data.query && this.data.query.fetchAllFields);
  }

  private async buildQuery(): Promise<string> {
    const fields: string[] = [];
    const whereFilter = this.data.query?.filter ? ` WHERE ${this.data.query.filter}` : '';
    const limitClause = this.data.query?.limit ? ` LIMIT ${this.data.query.limit}` : '';
    (await this.describeObject()).fields.forEach((field) => fields.push(field.name));
    return `SELECT ${fields.join(',')} FROM ${this.data.objectName}${whereFilter}${limitClause}`;
  }
}
