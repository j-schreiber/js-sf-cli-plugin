import fs from 'node:fs';
import { Connection } from '@salesforce/core';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';

export default class DescribeApi {
  private cachePath: string;

  public constructor(private conn: Connection) {
    this.cachePath = `./.sfdami/${conn.getUsername() as string}/describes`;
  }

  public async describeSObject(sobjectName: string): Promise<DescribeSObjectResult> {
    let describeResult: DescribeSObjectResult;
    const fullFilePath = `${this.cachePath}/${sobjectName}.json`;
    if (fs.existsSync(fullFilePath)) {
      describeResult = JSON.parse(fs.readFileSync(fullFilePath, 'utf-8')) as DescribeSObjectResult;
      return describeResult;
    }
    fs.mkdirSync(this.cachePath, { recursive: true });
    describeResult = await this.conn.describe(sobjectName);
    fs.writeFileSync(fullFilePath, JSON.stringify(describeResult, null, 2));
    return describeResult;
  }
}
