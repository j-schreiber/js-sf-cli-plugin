import { json2csv } from 'json-2-csv';
import ResultsReporter, { FormattingOptions } from './resultsReporter.js';

export type CsvFormattingOptions = FormattingOptions & {
  /**
   * Render a title for the table
   */
  title?: string;
  /**
   * Explicitly remove columns from display.
   */
  excludeColumns?: string[];
};

/**
 * Prints input data to the standard UX table.
 */
export default class CsvResultsReporter<T extends Record<string, unknown>> extends ResultsReporter<T> {
  public constructor(public data: T[], public options?: CsvFormattingOptions) {
    super(data, options);
  }

  public print(): void {
    const csvOutput = json2csv(this.data);
    this.ux.log(csvOutput);
  }
}
