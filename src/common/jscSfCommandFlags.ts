import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.common');

export enum OutputFormats {
  PackageXML = 'PackageXML',
  DestructiveChangesXML = 'DestructiveChangesXML',
}

export const outputFormatFlag = Flags.custom<OutputFormats>({
  char: 'f',
  summary: messages.getMessage('flags.output-format.summary'),
  description: messages.getMessage('flags.output-format.description'),
  options: Object.values(OutputFormats),
  dependsOn: ['output-dir'],
});

export const manifestOutputDirFlag = Flags.file({
  exists: false,
  summary: messages.getMessage('flags.output-dir.summary'),
  description: messages.getMessage('flags.output-dir.description'),
  char: 'd',
});
