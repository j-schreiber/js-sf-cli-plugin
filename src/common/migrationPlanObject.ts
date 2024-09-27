import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { MigrationPlanObjectData, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import DescribeApi from './metadata/describeApi.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sfdami', 'exportplan');

export default class MigrationPlanObject {
  private describeResult?: DescribeSObjectResult;
  private queryString?: string;
  private queryIsValid?: boolean;

  public constructor(private data: MigrationPlanObjectData, private conn: Connection) {}

  //      PUBLIC API

  public getObjectName(): string {
    return this.data.objectName;
  }

  public async load(): Promise<MigrationPlanObject> {
    await this.describeObject();
    await this.getQueryString();
    this.queryIsValid = await this.checkQuery();
    return this;
  }

  public selfCheck(): boolean {
    if (Number(this.hasValidFile()) + Number(this.hasQueryString()) + Number(this.hasQueryConstructor()) > 1) {
      throw messages.createError('too-many-query-sources-defined');
    }
    if (!this.queryString) {
      throw messages.createError('no-query-defined-for-object', [this.data.objectName]);
    }
    if (!this.queryIsValid) {
      throw new Error(`Invalid query syntax: ${this.queryString}`);
    }
    return true;
  }

  public async retrieveRecords(exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    // TODO: Find a way to use standard CLI logger
    process.stdout.write(`Starting retrieval of ${this.data.objectName}\n`);
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    // fetchSize & autoFetch = true do not work with queryMore, 2000 already is the max number
    const queryString = await this.getQueryString();
    const queryResult = await this.conn.query(queryString);
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
      const moreResults = await this.conn.queryMore(nextRecordsUrl as string);
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
    if (this.queryString) {
      return this.queryString;
    }
    if (this.hasQueryString()) {
      this.queryString = String(this.data.queryString);
    } else if (this.hasValidFile()) {
      this.queryString = this.loadQueryStringFromFile();
    } else if (this.hasQueryConstructor()) {
      this.queryString = await this.buildQuery();
    }
    return this.queryString!;
  }

  //        PRIVATE

  public async checkQuery(): Promise<boolean> {
    if (!this.queryString) {
      return false;
    }
    try {
      await this.conn.query(this.buildValidatorQuery());
      return true;
    } catch (err) {
      return false;
    }
  }

  private buildValidatorQuery(): string {
    const rawQuery: string = this.queryString!;
    if (rawQuery.includes(' LIMIT ')) {
      return rawQuery.replace('(LIMIT) [0-9]+', 'LIMIT 1');
    } else {
      return `${rawQuery} LIMIT 1`;
    }
  }

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
