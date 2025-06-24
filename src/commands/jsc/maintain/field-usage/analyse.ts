/* eslint-disable no-await-in-loop */
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import SObjectAnalyser from '../../../../field-usage/sobjectAnalyser.js';
import { FieldUsageTable } from '../../../../field-usage/fieldUsageTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  usageReports: FieldUsageTable[];
};

const DESCRIBE_STAGE = 'Describe SObject';
const FIELD_STAGE = 'Analyse Fields';
const OUTPUT_STAGE = 'Format Output';

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
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JscMaintainFieldUsageAnalyseResult> {
    const { flags } = await this.parse(JscMaintainFieldUsageAnalyse);
    const targetOrg = flags['target-org'].getConnection(flags['api-version']);
    const analyser = new SObjectAnalyser(targetOrg);

    const fieldUsageTables: FieldUsageTable[] = [];
    for (const sobj of flags.sobject) {
      const ms = new MultiStageOutput<MultiStageData>({
        jsonEnabled: false,
        stages: [DESCRIBE_STAGE, FIELD_STAGE, OUTPUT_STAGE],
        stageSpecificBlock: [
          {
            get: (data) => data?.totalRecords,
            stage: DESCRIBE_STAGE,
            type: 'dynamic-key-value',
            label: 'Records retrieved',
          },
          {
            get: (data) => data?.fieldCount,
            stage: FIELD_STAGE,
            type: 'dynamic-key-value',
            label: 'Total fields to analyse',
          },
          {
            get: (data) => data?.fieldInAnalysis,
            stage: FIELD_STAGE,
            type: 'message',
          },
        ],
        title: `Analyse ${sobj}`,
      });

      analyser.on('describeSuccess', (data: { fieldCount: number }) => {
        ms.goto(FIELD_STAGE, { fieldCount: `${data.fieldCount}` });
      });
      analyser.on('totalRecordsRetrieve', (data: { totalCount: number }) => {
        ms.updateData({ totalRecords: `${data.totalCount}` });
      });
      analyser.on('fieldAnalysis', (data: { fieldName: string; fieldCounter: string }) => {
        ms.goto(FIELD_STAGE, { fieldInAnalysis: `Analysing ${data.fieldCounter}: ${data.fieldName}` });
      });

      ms.goto(DESCRIBE_STAGE);
      const sobjectUsageResult = await analyser.analyseFieldUsage(sobj, {
        customFieldsOnly: flags['custom-fields-only'],
      });
      ms.goto(OUTPUT_STAGE);
      fieldUsageTables.push(sobjectUsageResult);
      ms.stop();
      analyser.removeAllListeners();
      this.table({
        data: sobjectUsageResult.fields.map((field) => {
          const result = {
            ...field,
            percentFormatted: field.percentagePopulated.toLocaleString('de', {
              style: 'percent',
              minimumFractionDigits: 2,
            }),
          };
          return result;
        }),
        columns: ['name', 'type', 'absolutePopulated', { key: 'percentFormatted', name: 'Percent' }],
      });
    }
    return { usageReports: fieldUsageTables };
  }
}

type MultiStageData = {
  fieldCount: string;
  totalRecords: string;
  fieldInAnalysis: string;
};
