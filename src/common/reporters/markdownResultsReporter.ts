import { Ux } from '@salesforce/sf-plugins-core';
import { markdownTable } from 'markdown-table';
import { capitalCase } from 'change-case';
import ResultsReporter, { FormattingOptions } from './resultsReporter.js';

export type MarkdownFormattingOptions = FormattingOptions & {
  /**
   * Specify optional formattings, where the key is a column name.
   */
  formattings?: Record<string, MarkdownColumnFormatting>;
};

export type MarkdownColumnFormatting = {
  style: 'code' | 'none' | 'bold' | 'italic';
};

/**
 * Prints input data to the standard UX table.
 */
export default class MarkdownResultsReporter<T extends Record<string, unknown>> extends ResultsReporter<T> {
  public constructor(public data: T[], public readonly options?: MarkdownFormattingOptions) {
    super(data, options);
  }

  public prepare(): string[][] {
    if (this.data.length === 0) {
      return [];
    }
    const markdownOutput: string[][] = [];
    // columns are always set for markdown
    markdownOutput.push(formatColumns(this.columns, this.options?.capitalizeHeaders));
    this.data.forEach((record) => {
      const row: string[] = [];
      this.columns.forEach((field) => {
        row.push(this.format(field, record[field]));
      });
      markdownOutput.push(row);
    });
    return markdownOutput;
  }

  public print(): void {
    const ux = new Ux();
    if (this.options?.title) {
      ux.log('\n');
      ux.log(this.options.title);
      ux.log(`${'='.repeat(this.options.title.length)}\n`);
    }
    const tableData = this.prepare();
    if (tableData.length === 0) {
      return;
    }
    ux.log(markdownTable(tableData));
  }

  private format(fieldName: string, value: unknown): string {
    const stringValue = toString(value);
    if (this.options?.formattings?.[fieldName]?.style) {
      switch (this.options?.formattings?.[fieldName]?.style) {
        case 'none':
          return stringValue;
        case 'bold':
          return bold(stringValue);
        case 'italic':
          return italic(stringValue);
        case 'code':
          return code(stringValue);
      }
    }
    return stringValue;
  }
}

function formatColumns(rawColumns?: string[], capitalize?: boolean): string[] {
  if (!rawColumns) {
    return [];
  }
  return capitalize ? rawColumns.map((col) => capitalCase(col)) : rawColumns;
}

function toString(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return `${value}`;
    case 'boolean':
      return `${value}`;
    case 'number':
      return value.toLocaleString();
    case 'bigint':
      return value.toLocaleString();
    default:
      return '';
  }
}
function bold(input: string): string {
  return `**${input}**`;
}
function italic(input: string): string {
  return `*${input}*`;
}
function code(input: string): string {
  return `\`${input}\``;
}
