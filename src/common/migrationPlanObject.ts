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
  private queryResult: MigrationPlanObjectQueryResult;
  private isDone: boolean;
  private isReady: boolean;

  public constructor(private data: ZMigrationPlanObjectDataType, private conn: Connection) {
    this.queryResult = {
      isSuccess: false,
      queryString: '',
      totalSize: 0,
      files: [],
      executedFullQueryStrings: [],
    };
    this.isDone = false;
    this.isReady = false;
  }

  //      PUBLIC API

  public getObjectName(): string {
    return this.data.objectName;
  }

  public async load(): Promise<MigrationPlanObject> {
    this.describeResult = await this.describeObject();
    this.queryBuilder = new QueryBuilder(this.data, this.describeResult);
    if (await this.queryBuilder.assertSyntax(this.conn)) {
      this.queryResult.queryString = this.queryBuilder.toDisplaySOQL();
    }
    this.assertExports(this.describeResult);
    this.isReady = true;
    return this;
  }

  /**
   * Retrieves all records from the query configuration and stores them in JSON
   * files at the exportPath location. Results are cached, subsequent calls do not
   * run queries again. Depending on the total number of records to retrieve, this
   * may run a very long time.
   *
   * @param exportPath
   * @returns
   */
  public async retrieveRecords(exportPath: string): Promise<MigrationPlanObjectQueryResult> {
    if (!this.isReady) {
      await this.load();
    }
    if (this.isDone) {
      return this.queryResult;
    }
    fs.mkdirSync(`${exportPath}/${this.data.objectName}`, { recursive: true });
    const queries = this.resolveAllQueries();
    let totalRequestCount = 0;
    for (const queryString of queries) {
      let thisChunkRequestsCount = 1;
      eventBus.emit('planObjectStatus', {
        message: `Processing chunk ${queries.indexOf(queryString) + 1} of ${queries.length}: 1st request`,
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
      totalRequestCount++;
      this.queryResult.executedFullQueryStrings.push(queryString);
      const queryResult = await this.runQuery(queryString);
      this.queryResult.totalSize += queryResult.records.length;
      const totalBatches = Math.ceil(queryResult.totalSize / queryResult.records.length);
      let isDone = queryResult.done;
      let nextRecordsUrl = queryResult.nextRecordsUrl;
      const filePath = this.processResults(queryResult.records, exportPath, totalRequestCount);
      if (filePath) {
        this.queryResult.files.push(filePath);
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
        const queryMorePath = this.processResults(moreResults.records, exportPath, totalRequestCount);
        if (queryMorePath) {
          this.queryResult.files.push(queryMorePath);
        }
        this.queryResult.totalSize += moreResults.records.length;
      }
    }
    if (this.queryResult.totalSize === 0) {
      this.processResults([], exportPath, totalRequestCount);
    }
    this.queryResult.isSuccess = true;
    this.isDone = true;
    return this.queryResult;
  }

  /**
   * Returns the current status of the result, even if retrieve records has not been
   * executed yet.
   *
   * @returns
   */
  public async getResult(): Promise<MigrationPlanObjectQueryResult> {
    if (!this.isReady) {
      await this.load();
    }
    return this.queryResult;
  }

  public resolveQueryString(): string {
    return this.queryBuilder!.toSOQL();
  }

  //        PRIVATE

  private hasExports(): boolean {
    return Boolean(this.data.exports);
  }

  private processResults(queryRecords: Record[], exportPath: string, incrementer: number): string | undefined {
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
    if (queryRecords.length > 0) {
      return this.writeResultsToFile(queryRecords, exportPath, incrementer);
    } else {
      return undefined;
    }
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

  private async describeObject(): Promise<DescribeSObjectResult> {
    if (!this.describeResult) {
      const descApi: DescribeApi = new DescribeApi(this.conn);
      try {
        this.describeResult = await descApi.describeSObject(this.data.objectName, this.data.isToolingObject);
      } catch (err) {
        throw messages.createError('InvalidSObjectName', [this.getObjectName(), String(err)]);
      }
    }
    return this.describeResult;
  }

  private resolveAllQueries(): string[] {
    if (this.data.query?.bind && PlanCache.isSet(this.data.query.bind.variable)) {
      const chunkedParentQueries: string[] = [];
      const chunks = PlanCache.getChunks(this.data.query.bind.variable);
      eventBus.emit('planObjectStatus', {
        message: `Fetching records in ${chunks.length} chunks of ${PlanCache.CHUNK_SIZE} parent ids each`,
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
      chunks.forEach((parentIdsChunk) => chunkedParentQueries.push(this.queryBuilder!.toSOQL(parentIdsChunk)));
      return chunkedParentQueries;
    }
    return [this.resolveQueryString()];
  }
}
