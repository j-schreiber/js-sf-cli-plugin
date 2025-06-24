import fs from 'node:fs';
import { Connection, Messages } from '@salesforce/core';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { LOCAL_CACHE_DIR } from '../constants.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'exportplan');

export default class DescribeApi {
  private readonly cachePath: string;

  public constructor(private readonly conn: Connection) {
    this.cachePath = `./${LOCAL_CACHE_DIR}/${conn.getUsername() as string}/describes`;
  }

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
