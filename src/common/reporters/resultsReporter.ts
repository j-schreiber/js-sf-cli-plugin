import { Ux } from '@salesforce/sf-plugins-core';

export type FormattingOptions = {
  /**
   * Run "capitalCase" transformer on columns ("myValue" is converted to "My Value")
   */
  capitalizeHeaders?: boolean;
  /**
   * Render a title for the table
   */
  title?: string;
  /**
   * Explicitly specify the columns to display. The table will always show these
   * columns, even if the data does not have the keys. If this is not specified,
   * the table will determine columns dynamically.
   */
  columns?: string[];
  /**
   * Explicitly remove columns from display. If columns are specified as well,
   * they are removed from the table again. This is mostly useful when columns
   * are determined automatically.
   */
  excludeColumns?: string[];
  /**
   * Passes the --json flag to all reporters to surpress output when command
   * is executed with --json. The default behavior is JSON "disabled",
   * meaning "output enabled".
   */
  jsonEnabled?: boolean;
};

export default abstract class ResultsReporter<T extends Record<string, unknown>> {
  public columns: string[];
  public ux: Ux;

  public constructor(public data: T[], public options?: FormattingOptions) {
    this.columns = retrieveColumns(data, options);
    this.ux = new Ux({ jsonEnabled: this.options?.jsonEnabled ?? false });
  }

  /**
   * Prints results to stdout
   */
  public abstract print(): void;
}

function retrieveColumns(data: Array<Record<string, unknown>>, options?: FormattingOptions): string[] {
  let cols: string[];
  if (options?.columns !== undefined) {
    cols = [...options.columns];
  } else {
    // iterate each entry in data to make sure we gather all populated properties
    const allKeys = new Set();
    data.forEach((entry) => {
      Object.keys(entry).forEach((col) => allKeys.add(col));
    });
    cols = Array.from(allKeys) as string[];
  }
  if (data.length === 0) {
    return [];
  }
  if (options?.excludeColumns) {
    return cols.filter((col) => !options.excludeColumns?.includes(col));
  } else {
    return cols;
  }
}
