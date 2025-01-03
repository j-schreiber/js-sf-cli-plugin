/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import { DescribeSObjectResult, QueryResult, Record } from '@jsforce/jsforce-node';
import { Connection, Messages, SfError } from '@salesforce/core';
import { ZMigrationPlanObjectDataType, MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import DescribeApi from './metadata/describeApi.js';
import QueryBuilder from './utils/queryBuilder.js';
import { eventBus } from './comms/eventBus.js';
import { ProcessingStatus, CommandStatusEvent } from './comms/processingEvents.js';
import PlanCache from './planCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'exportplan');

export default class MigrationPlanObject {
  private describeResult?: DescribeSObjectResult;
  private queryBuilder?: QueryBuilder;

  public constructor(private data: ZMigrationPlanObjectDataType, private conn: Connection) {}

  //      PUBLIC API

  public getObjectName(): string {
    return this.data.objectName;
  }

  public async load(): Promise<MigrationPlanObject> {
    this.describeResult = await this.describeObject();
    this.assertQueryDefinitions();
    this.assertExports(this.describeResult);
    await this.assertQuerySyntax(this.describeResult);
    return this;
  }

  public async retrieveRecords(exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    const result: MigrationPlanObjectQueryResult = {
      isSuccess: false,
      queryString: this.resolveQueryString(),
      totalSize: 0,
      files: [],
    };
    const queries = this.resolveAllQueries();
    let totalRequestCount = 0;
    for (const queryString of queries) {
      let thisChunkRequestsCount = 1;
      eventBus.emit('planObjectStatus', {
        message: `Processing chunk ${queries.indexOf(queryString) + 1} of ${queries.length}: 1st request`,
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
      totalRequestCount++;
      const queryResult = await this.runQuery(queryString);
      result.totalSize += queryResult.records.length;
      const totalBatches = Math.ceil(queryResult.totalSize / queryResult.records.length);
      let isDone = queryResult.done;
      let nextRecordsUrl = queryResult.nextRecordsUrl;
      if (queryResult.records.length > 0) {
        result.files.push(this.processResults(queryResult.records, exportPath, totalRequestCount));
      }
      while (!isDone) {
        thisChunkRequestsCount++;
        totalRequestCount++;
        eventBus.emit('planObjectStatus', {
          message: `Processing chunk ${queries.indexOf(queryString) + 1} of ${
            queries.length
          }: ${thisChunkRequestsCount}/${totalBatches} requests`,
          status: ProcessingStatus.InProgress,
        } as CommandStatusEvent);
        const moreResults = await this.conn.queryMore(nextRecordsUrl as string);
        isDone = moreResults.done;
        nextRecordsUrl = moreResults.nextRecordsUrl;
        result.files.push(this.processResults(moreResults.records, exportPath, totalRequestCount));
        result.totalSize += moreResults.records.length;
      }
    }
    result.isSuccess = true;
    return result;
  }

  public async describeObject(): Promise<DescribeSObjectResult> {
    if (!this.describeResult) {
      const descApi: DescribeApi = new DescribeApi(this.conn);
      try {
        this.describeResult = await descApi.describeSObject(this.data.objectName, this.data.isToolingObject);
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
      return this.queryBuilder!.toSOQL(this.data.query);
    }
    throw new Error(`No query defined for: ${this.getObjectName()}`);
  }

  public resolveAllQueries(): string[] {
    if (this.data.query?.bind && PlanCache.isSet(this.data.query.bind.variable)) {
      const chunkedParentQueries: string[] = [];
      const chunks = PlanCache.getChunks(this.data.query.bind.variable);
      eventBus.emit('planObjectStatus', {
        message: `Fetching records in ${chunks.length} chunks of ${PlanCache.CHUNK_SIZE} parent ids each`,
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
      chunks.forEach((parentIdsChunk) =>
        chunkedParentQueries.push(this.queryBuilder!.toSOQL(this.data.query, parentIdsChunk))
      );
      return chunkedParentQueries;
    }
    return [this.resolveQueryString()];
  }

  public hasExports(): boolean {
    return Boolean(this.data.exports);
  }

  //        PRIVATE

  private processResults(queryRecords: Record[], exportPath: string, incrementer: number): string {
    if (this.data.exports) {
      Object.keys(this.data.exports).forEach((exportFieldName) => {
        const recordIds: string[] = [];
        for (const record of queryRecords) {
          if (record[exportFieldName]) {
            recordIds.push(record[exportFieldName] as string);
          }
        }
        PlanCache.push(this.data.exports![exportFieldName], recordIds);
      });
    }
    return this.writeResultsToFile(queryRecords, exportPath, incrementer);
  }

  private writeResultsToFile(queryRecords: unknown, exportPath: string, incrementer: number): string {
    const fullFilePath = `${exportPath}/${this.data.objectName}/${incrementer}.json`;
    fs.writeFileSync(fullFilePath, JSON.stringify({ records: queryRecords }, null, 2));
    return fullFilePath;
  }

  private async runQuery(queryString: string): Promise<QueryResult<Record>> {
    let result;
    if (this.data.isToolingObject) {
      result = await this.conn.tooling.query(queryString);
    } else {
      result = await this.conn.query(queryString);
    }
    return result;
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

  private assertExports(describe: DescribeSObjectResult): void {
    if (this.hasExports()) {
      Object.keys(this.data.exports!).forEach((exportFieldName) => {
        const fieldDescribe = describe.fields.find((element) => element.name === exportFieldName);
        if (fieldDescribe === undefined) {
          throw new SfError(
            `Exported field ${exportFieldName} does not exist on ${this.getObjectName()}.`,
            'InvalidPlanFileSyntax'
          );
        }
        const validTypes = ['id', 'reference', 'int', 'string'];
        if (!validTypes.includes(fieldDescribe.type)) {
          throw new SfError(
            `Exported field ${exportFieldName} has invalid type: ${
              fieldDescribe.type
            }. Valid types are: ${validTypes.join(',')}`,
            'InvalidPlanFileSyntax'
          );
        }
      });
    }
  }

  private async assertQuerySyntax(describe: DescribeSObjectResult): Promise<void> {
    this.queryBuilder = new QueryBuilder(describe);
    await this.queryBuilder.assertSyntax(this.conn, this.resolveQueryString());
  }
}
