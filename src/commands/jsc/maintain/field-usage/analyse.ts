/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import SObjectAnalyser from '../../../../field-usage/sobjectAnalyser.js';
import { FieldUsageTable } from '../../../../field-usage/fieldUsageTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  usageReports: FieldUsageTable[];
};

export default class JscMaintainFieldUsageAnalyse extends SfCommand<JscMaintainFieldUsageAnalyseResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    sobject: Flags.string({
      multiple: true,
      required: true,
      char: 's',
      summary: messages.getMessage('flags.sobject.summary'),
      description: messages.getMessage('flags.sobject.description'),
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'custom-fields-only': Flags.boolean({
      summary: messages.getMessage('flags.custom-fields-only.summary'),
      description: messages.getMessage('flags.custom-fields-only.description'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JscMaintainFieldUsageAnalyseResult> {
    const { flags } = await this.parse(JscMaintainFieldUsageAnalyse);
    const targetOrg = flags['target-org'].getConnection(flags['api-version']);
    const analyser = new SObjectAnalyser(targetOrg);
    const sobjects = flags.sobject;

    // show spinner that informs of status
    //  sobject describes (+ name validation)
    //  sobject analysis (update spinner per field)
    //  output formatting (sort table by count descending)
    const fieldUsageTables: FieldUsageTable[] = [];
    for (const sobj of sobjects) {
      const sobjectUsageResult = await analyser.analyseFieldUsage(sobj, {
        customFieldsOnly: flags['custom-fields-only'],
      });
      fieldUsageTables.push(sobjectUsageResult);
      this.table({ data: sobjectUsageResult.fields, title: sobjectUsageResult.name });
    }
    return { usageReports: fieldUsageTables };
  }
}
