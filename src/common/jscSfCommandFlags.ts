import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.common');

/**
 * Formats for package manifests
 */
export enum OutputFormats {
  PackageXML = 'PackageXML',
  DestructiveChangesXML = 'DestructiveChangesXML',
}

/**
 * Formats for table output to stdout
 */
export enum ResultFormats {
  human = 'human',
  csv = 'csv',
  markdown = 'markdown',
}

export const outputFormatFlag = Flags.custom<OutputFormats>({
  char: 'f',
  summary: messages.getMessage('flags.output-format.summary'),
  description: messages.getMessage('flags.output-format.description'),
  options: Object.values(OutputFormats),
  dependsOn: ['output-dir'],
});

export const resultFormatFlag = Flags.custom<ResultFormats>({
  char: 'r',
  summary: messages.getMessage('flags.result-format.summary'),
  description: messages.getMessage('flags.result-format.description'),
  options: Object.values(ResultFormats),
  default: ResultFormats.human,
});

export const manifestOutputDirFlag = Flags.file({
  exists: false,
  summary: messages.getMessage('flags.output-dir.summary'),
  description: messages.getMessage('flags.output-dir.description'),
  char: 'd',
});

export const conciseFlowExportTable = Flags.boolean({
  summary: messages.getMessage('flags.concise.summary'),
  description: messages.getMessage('flags.concise.description'),
});
