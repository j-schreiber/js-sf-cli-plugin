import fs from 'node:fs';
import { Connection, Messages } from '@salesforce/core';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { LOCAL_CACHE_DIR } from '../constants.js';
import { ChildRelationship, DescribeHistoryResult, DescribeRecordTypeResult } from '../../types/platformTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'exportplan');

export default class DescribeApi {
  private readonly cachePath: string;

  public constructor(private readonly conn: Connection) {
    this.cachePath = `./${LOCAL_CACHE_DIR}/${conn.getUsername() as string}/describes`;
  }

  public async resolveHistoryRelationship(
    sobjDescribe: DescribeSObjectResult
  ): Promise<DescribeHistoryResult | undefined> {
    const childRel = getHistoryRelationship(sobjDescribe);
    if (!childRel) {
      return undefined;
    }
    const historyDescribe = await this.describeSObject(childRel.childSObject);
    return { relationship: childRel, describe: historyDescribe };
  }

  /**
   * Resolve all valid record types from a sobject describe result
   *
   * @param sobjDescribe
   */
  public async resolveRecordTypes(
    sobjDescribe: DescribeSObjectResult
  ): Promise<Record<string, DescribeRecordTypeResult>> {
    if (!sobjDescribe.recordTypeInfos || sobjDescribe.recordTypeInfos.length === 0) {
      return {};
    }
    const queryableTypes: string[] = [];
    sobjDescribe.recordTypeInfos.forEach((rti) => {
      if (!rti.master) {
        queryableTypes.push(rti.recordTypeId);
      }
    });
    return this.describeRecordTypes(queryableTypes);
  }

  /**
   * Describes a list of record types by their id and returns a dictionary
   * that maps ids to their describe result.
   *
   * @param ids
   */
  public async describeRecordTypes(ids: string[]): Promise<Record<string, DescribeRecordTypeResult>> {
    const describePromises: Array<Promise<DescribeRecordTypeResult>> = [];
    ids.forEach((id) => describePromises.push(this.describeRecordType(id)));
    const describes = await Promise.all(describePromises);
    const result: Record<string, DescribeRecordTypeResult> = {};
    describes.forEach((desc) => (result[desc.id] = desc));
    return result;
  }

  /**
   * Describes a record type by its id.
   *
   * @param recordTypeId
   * @returns
   */
  public async describeRecordType(recordTypeId: string): Promise<DescribeRecordTypeResult> {
    const rtResult = await this.conn.tooling.query<{ Metadata: Partial<DescribeRecordTypeResult> }>(
      `SELECT Metadata FROM RecordType WHERE Id = '${recordTypeId}'`
    );
    if (rtResult.records.length < 1) {
      throw messages.createError('InvalidRecordTypeId', [recordTypeId]);
    }
    return { ...rtResult.records[0].Metadata, id: recordTypeId } as DescribeRecordTypeResult;
  }

  /**
   * Describes an sobject by its developer name and caches the result.
   *
   * @param objectName
   * @param isToolingObject Specify for tooling api objects
   * @returns
   */
  public async describeSObject(objectName: string, isToolingObject?: boolean): Promise<DescribeSObjectResult> {
    let describeResult: DescribeSObjectResult;
    const fullFilePath = `${this.cachePath}/${objectName}.json`;
    if (fs.existsSync(fullFilePath)) {
      describeResult = JSON.parse(fs.readFileSync(fullFilePath, 'utf-8')) as DescribeSObjectResult;
      return describeResult;
    }
    fs.mkdirSync(this.cachePath, { recursive: true });
    describeResult = await this.fetchDescribe(objectName, isToolingObject);
    fs.writeFileSync(fullFilePath, JSON.stringify(describeResult, null, 2));
    return describeResult;
  }

  private async fetchDescribe(objectName: string, isToolingObject?: boolean): Promise<DescribeSObjectResult> {
    try {
      if (isToolingObject) {
        const result = await this.conn.tooling.describe(objectName);
        return result;
      } else {
        const result = await this.conn.describe(objectName);
        return result;
      }
    } catch (err) {
      throw messages.createError('InvalidSObjectName', [objectName, String(err)]);
    }
  }
}

function getHistoryRelationship(describeResult: DescribeSObjectResult): ChildRelationship | undefined {
  if (describeResult.childRelationships?.length > 0) {
    for (const cr of describeResult.childRelationships) {
      if (cr.relationshipName === 'Histories') {
        return cr;
      }
    }
  }
  return undefined;
}
