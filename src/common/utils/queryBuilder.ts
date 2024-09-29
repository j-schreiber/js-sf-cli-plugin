import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';

export default class QueryBuilder {
  private selectFields: Set<string> = new Set<string>();
  private limit?: number;
  private filter?: string;

  public constructor(public describeResult: DescribeSObjectResult) {
    this.selectFields.add('Id');
  }

  public static loadFromFile(filePath?: string): string {
    if (!(filePath && filePath.trim() !== '')) {
      throw new Error('Cannot load query. Invalid or empty filepath.');
    }
    if (fs.existsSync(filePath)) {
      const queryString = fs.readFileSync(filePath, 'utf8');
      return queryString.trim().replace(/\s+/g, ' ');
    } else {
      throw new Error(`Cannot load query. ${filePath} does not exist.`);
    }
  }

  public static makeValidatorQuery(rawQuery: string): string {
    if (rawQuery.includes('LIMIT')) {
      const cleanedQuery = rawQuery.replace(/\s+/g, ' ');
      return cleanedQuery.replace(/(LIMIT)(\s)*[0-9]+$/, 'LIMIT 1');
    } else {
      return `${rawQuery} LIMIT 1`;
    }
  }

  public addAllFields(): QueryBuilder {
    this.describeResult.fields.forEach((field) => this.selectFields.add(field.name));
    return this;
  }

  public setLimit(limit?: number): QueryBuilder {
    this.limit = limit;
    return this;
  }

  public setWhere(filter?: string): QueryBuilder {
    this.filter = filter;
    return this;
  }

  public toSOQL(): string {
    const whereFilter = this.filter ? ` WHERE ${this.filter}` : '';
    const limitClause = this.limit ? ` LIMIT ${this.limit}` : '';
    return `SELECT ${[...this.selectFields].join(',')} FROM ${this.describeResult.name}${whereFilter}${limitClause}`;
  }
}
