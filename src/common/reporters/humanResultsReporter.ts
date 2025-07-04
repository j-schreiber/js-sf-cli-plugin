import ResultsReporter, { FormattingOptions } from './resultsReporter.js';

export type HumanFormattingOptions = FormattingOptions & {
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
export default class HumanResultsReporter<T extends Record<string, unknown>> extends ResultsReporter<T> {
  public constructor(public data: T[], public options?: HumanFormattingOptions) {
    super(data, options);
  }

  public print(): void {
    this.ux.table({
      data: this.data,
      columns: this.columns,
      title: this.options?.title,
      titleOptions: { bold: true, underline: true },
    });
  }
}
