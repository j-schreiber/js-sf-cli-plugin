import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { MigrationPlanObjectData, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import DescribeApi from './metadata/describeApi.js';
import QueryBuilder from './utils/queryBuilder.js';
import { eventBus } from './comms/eventBus.js';
import { ProcessingStatus, PlanObjectEvent } from './comms/processingEvents.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sfdami', 'exportplan');

export default class MigrationPlanObject {
  private describeResult?: DescribeSObjectResult;
  private queryBuilder?: QueryBuilder;
  private queryString?: string;

  public constructor(private data: MigrationPlanObjectData, private conn: Connection) {}

  //      PUBLIC API

  public getObjectName(): string {
    return this.data.objectName;
  }

  public async load(): Promise<MigrationPlanObject> {
    this.describeResult = await this.describeObject();
    this.assertQueryDefinitions();
    this.queryBuilder = new QueryBuilder(this.describeResult);
    this.queryString = this.resolveQueryString();
    await QueryBuilder.assertQuerySyntax(this.conn, this.queryString);
    return this;
  }

  public async retrieveRecords(exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    this.emitQueryProgress(0, undefined);
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    // fetchSize & autoFetch = true do not work with queryMore, 2000 already is the max number
    const queryResult = await this.conn.query(this.queryString!);
    const totalBatches = Math.ceil(queryResult.totalSize / queryResult.records.length);
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: queryResult.done,
      queryString: this.queryString!,
      totalSize: queryResult.records.length,
      files: [],
    };
    let isDone = queryResult.done;
    let nextRecordsUrl = queryResult.nextRecordsUrl;
    let incrementer = 1;
    this.emitQueryProgress(incrementer, totalBatches);
    result.files.push(this.writeResultsToFile(queryResult.records, exportPath, incrementer));
    while (!isDone) {
      incrementer++;
      this.emitQueryProgress(incrementer, totalBatches);
      // eslint-disable-next-line no-await-in-loop
      const moreResults = await this.conn.queryMore(nextRecordsUrl as string);
      isDone = moreResults.done;
      nextRecordsUrl = moreResults.nextRecordsUrl;
      result.files.push(this.writeResultsToFile(moreResults.records, exportPath, incrementer));
      result.totalSize += moreResults.records.length;
    }
    return result;
  }

  public async describeObject(): Promise<DescribeSObjectResult> {
    if (!this.describeResult) {
      const descApi: DescribeApi = new DescribeApi(this.conn);
      try {
        this.describeResult = await descApi.describeSObject(this.data.objectName);
      } catch (err) {
        throw new Error(`Failed to fetch describe for ${this.getObjectName()}: ${String(err)}`);
      }
    }
    return this.describeResult;
  }

  public resolveQueryString(): string {
    if (this.hasQueryString()) {
      return String(this.data.queryString);
    } else if (this.hasValidFile()) {
      return QueryBuilder.loadFromFile(this.data.queryFile);
    } else if (this.hasQueryConstructor()) {
      this.queryBuilder!.setLimit(this.data.query?.limit).setWhere(this.data.query?.filter);
      if (this.data.query?.fetchAllFields) {
        this.queryBuilder!.addAllFields();
      }
      return this.queryBuilder!.toSOQL();
    }
    throw new Error(`No query defined for: ${this.getObjectName()}`);
  }

  //        PRIVATE

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

  private assertQueryDefinitions(): void {
    if (Number(this.hasValidFile()) + Number(this.hasQueryString()) + Number(this.hasQueryConstructor()) > 1) {
      throw messages.createError('too-many-query-sources-defined');
    }
  }

  private emitQueryProgress(currentCompleted: number, totalNumber?: number): void {
    eventBus.emit('planObjectEvent', {
      status: ProcessingStatus.InProgress,
      totalBatches: totalNumber,
      batchesCompleted: currentCompleted,
      objectName: this.getObjectName(),
    } as PlanObjectEvent);
  }
}
