import fs from 'node:fs';
import { Connection } from '@salesforce/core';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { LOCAL_CACHE_DIR } from '../constants.js';

export default class DescribeApi {
  private cachePath: string;

  public constructor(private conn: Connection) {
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
    if (isToolingObject) {
      describeResult = await this.conn.tooling.describe(objectName);
    } else {
      describeResult = await this.conn.describe(objectName);
    }
    fs.writeFileSync(fullFilePath, JSON.stringify(describeResult, null, 2));
    return describeResult;
  }
}
