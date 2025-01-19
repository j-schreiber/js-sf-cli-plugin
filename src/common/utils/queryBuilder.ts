import fs from 'node:fs';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { QueryError } from '../../types/sfStandardApiTypes.js';
import { ZMigrationPlanObjectDataType } from '../../types/migrationPlanObjectData.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'exportplan');

export default class QueryBuilder {
  private isToolingObject: boolean;
  private rawSOQL?: string;

  public constructor(private data: ZMigrationPlanObjectDataType, private describe: DescribeSObjectResult) {
    const queryCount =
      Number(Boolean(this.data.queryFile)) +
      Number(Boolean(this.data.queryString && this.data.queryString.trim() !== '')) +
      Number(Boolean(this.data.query));
    if (queryCount === 0) {
      throw messages.createError('NoQueryDefinedForSObject', [data.objectName]);
    }
    if (queryCount > 1) {
      throw messages.createError('TooManyQueriesDefined');
    }
    this.isToolingObject = this.describe.urls.sobject.includes('/tooling/sobjects/');
    if (data.queryString) {
      this.rawSOQL = QueryBuilder.sanitise(data.queryString);
    } else if (data.queryFile) {
      this.rawSOQL = QueryBuilder.loadFromFile(data.queryFile);
    }
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

  public static buildParamListFilter(paramName: string, paramList?: string[] | number[]): string {
    if (paramList === undefined) {
      return '';
    }
    const quotedParamList = paramList.map((val) => `'${val}'`);
    const listInFilter = quotedParamList.length > 0 ? `(${quotedParamList.join(',')})` : "('')";
    return `${paramName} IN ${listInFilter} AND ${paramName} != NULL`;
  }

  /**
   * Runs the "validator query" from this builder against the
   * supplied org connection.
   *
   * @param conn
   * @returns
   */
  public async assertSyntax(conn: Connection): Promise<boolean> {
    const queryString = this.toValidatorSOQL();
    try {
      if (this.isToolingObject) {
        await conn.tooling.query(queryString);
      } else {
        await conn.query(queryString);
      }
      return true;
    } catch (err) {
      const queryApiErr: QueryError = err as QueryError;
      throw new Error(
        `Invalid query syntax: ${this.toSOQL()} (${queryApiErr.errorCode}: ${queryApiErr.data?.message})`
      );
    }
  }

  /**
   * Creates a real, executable SOQL that injects the chunk of parent ids,
   * if a bind variable is specified. If bind is undefined, parent ids are
   * ignored.
   *
   * @param parentIds
   * @returns
   */
  public toSOQL(parentIds?: string[]): string {
    if (this.rawSOQL) {
      return this.rawSOQL;
    }
    if (this.data.query) {
      const limitClause = this.data.query.limit ? ` LIMIT ${this.data.query.limit}` : '';
      const whereClause = this.buildWhere(parentIds ?? []);
      return `SELECT ${[...this.getQueryFields()].join(',')} FROM ${
        this.describe.name
      }${whereClause}${limitClause}`.trim();
    }
    return `SELECT Id FROM ${this.describe.name}`;
  }

  /**
   * Creates an executable SOQL that injects an empty list of parent bind
   * variables and appends "LIMIT 0". This SOQL is executed during plan
   * validation.
   *
   * @returns
   */
  public toValidatorSOQL(): string {
    return this.formatRawSoqlAsValidator(this.toSOQL([]));
  }

  /**
   * Creates a SOQL that may not be executable, depending on the parent
   * binds of the query definition. Instead of injecting variables, it
   * mimicks the apex SOQL inline-syntax.
   */
  public toDisplaySOQL(): string {
    const soql = this.toSOQL([]);
    if (this.data.query?.bind) {
      return soql.replace("('')", `:${this.data.query.bind.variable}`);
    }
    return soql;
  }

  //    PRIVATE

  private buildWhere(parentIds: string[]): string {
    if (this.data.query?.bind && parentIds) {
      const parentBind = QueryBuilder.buildParamListFilter(this.data.query.bind.field, parentIds);
      if (this.data.query.filter) {
        return ` WHERE (${this.data.query.filter}) AND ${parentBind}`;
      } else {
        return ` WHERE ${parentBind}`;
      }
    } else if (this.data.query?.filter) {
      return ` WHERE ${this.data.query.filter}`;
    }
    return '';
  }

  private getQueryFields(): Set<string> {
    const fields: Set<string> = new Set<string>();
    if (this.data.query?.fetchAllFields) {
      this.describe.fields.forEach((field) => fields.add(field.name));
    } else {
      fields.add('Id');
    }
    return fields;
  }

  // eslint-disable-next-line class-methods-use-this
  private formatRawSoqlAsValidator(rawQuery: string): string {
    if (rawQuery.includes('LIMIT')) {
      const cleanedQuery = rawQuery.replace(/\s+/g, ' ');
      return cleanedQuery.replace(/(LIMIT)(\s)*[0-9]+$/, 'LIMIT 0');
    }
    return `${rawQuery} LIMIT 0`;
  }
}
