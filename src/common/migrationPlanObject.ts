import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { MigrationPlanObjectData, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import DescribeApi from './metadata/describeApi.js';
import QueryBuilder from './utils/queryBuilder.js';

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
    this.queryString = await this.resolveQueryString();
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
    const queryResult = await this.conn.query(this.queryString!);
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: queryResult.done,
      queryString: this.queryString!,
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

  public async resolveQueryString(): Promise<string | undefined> {
    if (this.hasQueryString()) {
      return String(this.data.queryString);
    } else if (this.hasValidFile()) {
      return QueryBuilder.loadFromFile(this.data.queryFile);
    } else if (this.hasQueryConstructor()) {
      const qb = new QueryBuilder(await this.describeObject())
        .setLimit(this.data.query?.limit)
        .setWhere(this.data.query?.filter);
      if (this.data.query?.fetchAllFields) {
        qb.addAllFields();
      }
      return qb.toSOQL();
    }
    return undefined;
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
    if (rawQuery.includes('LIMIT')) {
      return rawQuery.replace(new RegExp('(LIMIT)(\\s)*[0-9]+'), 'LIMIT 1');
    } else {
      return `${rawQuery} LIMIT 1`;
    }
  }

  private writeResultsToFile(queryRecords: unknown, exportPath: string, incrementer: number): string {
    const fullFilePath = `${exportPath}/${this.data.objectName}/${incrementer}.json`;
    fs.writeFileSync(fullFilePath, JSON.stringify({ records: queryRecords }, null, 2));
    return fullFilePath;
  }

  private hasQueryString(): boolean {
    return Boolean(this.data.queryString && this.data.queryString.trim() !== '');
  }

  private hasValidFile(): boolean {
    try {
      QueryBuilder.loadFromFile(this.data.queryFile);
      return true;
    } catch (err) {
      return false;
    }
  }

  private hasQueryConstructor(): boolean {
    return Boolean(this.data.query && this.data.query.fetchAllFields);
  }
}
