import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection } from '@salesforce/core';
import { QueryError } from '../../types/sfStandardApiTypes.js';
import { ZQueryObjectType } from '../../types/migrationPlanObjectData.js';

export default class QueryBuilder {
  private selectFields: Set<string> = new Set<string>();
  private limit?: number;
  private filter?: string;
  private parentBind?: string;

  public constructor(private describeResult: DescribeSObjectResult) {
    this.selectFields.add('Id');
  }

  public static loadFromFile(filePath?: string): string {
    if (!(filePath && filePath.trim() !== '')) {
      throw new Error('Cannot load query. Invalid or empty filepath.');
    }
    if (fs.existsSync(filePath)) {
      return QueryBuilder.sanitise(fs.readFileSync(filePath, 'utf8'));
    } else {
      throw new Error(`Cannot load query. ${filePath} does not exist.`);
    }
  }

  public static sanitise(rawQueryString: string): string {
    const cleanesFromSpaces = rawQueryString
      .replace(/\s+/g, ' ')
      .replace(/(?<=SELECT ).*(?= FROM)/gi, (_): string => _.replaceAll(' ', ''));
    return cleanesFromSpaces.trim();
  }

  public static makeValidatorQuery(rawQuery: string): string {
    if (rawQuery.includes('LIMIT')) {
      const cleanedQuery = rawQuery.replace(/\s+/g, ' ');
      return cleanedQuery.replace(/(LIMIT)(\s)*[0-9]+$/, 'LIMIT 1');
    } else {
      return `${rawQuery} LIMIT 1`;
    }
  }

  public static buildParamListFilter(paramName: string, paramList?: string[] | number[]): string {
    if (paramList === undefined) {
      return '';
    }
    const quotedParamList = paramList.map((val) => `'${val}'`);
    const listInFilter = quotedParamList.length > 0 ? `(${quotedParamList.join(',')})` : "('')";
    return `${paramName} IN ${listInFilter} AND ${paramName} != NULL`;
  }

  public async assertSyntax(conn: Connection, queryString?: string): Promise<boolean> {
    if (queryString === undefined || queryString.trim().length === 0) {
      throw new Error('Query cannot be empty!');
    }
    try {
      if (this.isToolingObject()) {
        await conn.tooling.query(QueryBuilder.makeValidatorQuery(queryString));
      } else {
        await conn.query(QueryBuilder.makeValidatorQuery(queryString));
      }
      return true;
    } catch (err) {
      const queryApiErr: QueryError = err as QueryError;
      throw new Error(`Invalid query syntax: ${queryString} (${queryApiErr.errorCode}: ${queryApiErr.data?.message})`);
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

  public toSOQL(queryConfig?: ZQueryObjectType, parentIds?: string[]): string {
    if (queryConfig) {
      this.readQueryConfig(queryConfig, parentIds);
    }
    const limitClause = this.limit ? ` LIMIT ${this.limit}` : '';
    return `SELECT ${[...this.selectFields].join(',')} FROM ${
      this.describeResult.name
    }${this.buildWhere()}${limitClause}`;
  }

  //    PRIVATE

  private isToolingObject(): boolean {
    return this.describeResult.urls.sobject.includes('/tooling/sobjects/');
  }

  private readQueryConfig(queryConfig: ZQueryObjectType, parentIds?: string[]): void {
    if (queryConfig.fetchAllFields) {
      this.addAllFields();
    }
    if (queryConfig.filter) {
      this.setWhere(queryConfig.filter);
    }
    if (queryConfig.limit) {
      this.setLimit(queryConfig.limit);
    }
    if (queryConfig.bind) {
      this.parentBind = QueryBuilder.buildParamListFilter(queryConfig.bind.field, parentIds);
    }
  }

  private buildWhere(): string {
    if (this.parentBind) {
      return this.filter ? ` WHERE (${this.filter}) AND ${this.parentBind}` : ` WHERE ${this.parentBind}`;
    } else {
      return this.filter ? ` WHERE ${this.filter}` : '';
    }
  }
}
