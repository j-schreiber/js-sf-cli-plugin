/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import SObjectAnalyser from '../../../../field-usage/sobjectAnalyser.js';
import { FieldUsageStats, FieldUsageTable } from '../../../../field-usage/fieldUsageTypes.js';
import FieldUsageMultiStageOutput, {
  DESCRIBE_STAGE,
  FIELD_STAGE,
  MultiStageData,
  OUTPUT_STAGE,
} from '../../../../field-usage/fieldUsageMultiStage.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  sobjects: Record<string, FieldUsageTable>;
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
      char: 'o',
      required: true,
    }),
    'custom-fields-only': Flags.boolean({
      summary: messages.getMessage('flags.custom-fields-only.summary'),
      description: messages.getMessage('flags.custom-fields-only.description'),
    }),
    'exclude-formulas': Flags.boolean({
      summary: messages.getMessage('flags.exclude-formulas.summary'),
      description: messages.getMessage('flags.exclude-formulas.description'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  private ms?: MultiStageOutput<MultiStageData>;

  public async run(): Promise<JscMaintainFieldUsageAnalyseResult> {
    const { flags } = await this.parse(JscMaintainFieldUsageAnalyse);
    const targetOrg = flags['target-org'].getConnection(flags['api-version']);

    const analyser = new SObjectAnalyser(targetOrg);
    analyser.on('describeSuccess', (data: { fieldCount: number; resolvedName: string }) => {
      this.ms?.updateData({ describeStatus: 'Success' });
      this.ms?.goto(FIELD_STAGE, { fieldCount: `${data.fieldCount}` });
    });
    analyser.on('totalRecordsRetrieve', (data: { totalCount: number }) => {
      this.ms?.updateData({ totalRecords: `${data.totalCount}` });
    });
    analyser.on('fieldAnalysis', (data: { fieldName: string; fieldCounter: string }) => {
      this.ms?.goto(FIELD_STAGE, { fieldInAnalysis: `Analysing ${data.fieldCounter}: ${data.fieldName}` });
    });

    const fieldUsageTables: Record<string, FieldUsageTable> = {};
    for (const sobj of flags.sobject) {
      this.ms = FieldUsageMultiStageOutput.newInstance(sobj, flags.json);
      this.ms.goto(DESCRIBE_STAGE);
      try {
        const sobjectUsageResult = await analyser.analyseFieldUsage(sobj, {
          customFieldsOnly: flags['custom-fields-only'],
          excludeFormulaFields: flags['exclude-formulas'],
        });
        this.ms.goto(OUTPUT_STAGE);
        fieldUsageTables[sobj] = sobjectUsageResult;
        const formattedOutput = formatOutput(sobjectUsageResult.fields);
        this.ms.stop('completed');
        this.table({
          data: formattedOutput,
          columns: ['name', 'type', 'absolutePopulated', { key: 'percentFormatted', name: 'Percent' }],
        });
      } catch (err) {
        this.ms.error();
        this.error(String(err));
      }
    }
    return { sobjects: fieldUsageTables };
  }
}

function formatOutput(data: FieldUsageStats[]): Array<FieldUsageStats & { percentFormatted: string }> {
  return data.map((field) => {
    const result = {
      ...field,
      percentFormatted: field.percentagePopulated.toLocaleString(undefined, {
        style: 'percent',
        minimumFractionDigits: 2,
      }),
    };
    return result;
  });
}
