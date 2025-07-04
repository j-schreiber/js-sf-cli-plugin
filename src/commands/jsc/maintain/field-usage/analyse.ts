/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { json2csv } from 'json-2-csv';
import SObjectAnalyser, { INCLUDED_FIELD_TYPES } from '../../../../field-usage/sobjectAnalyser.js';
import { FieldSkippedInfo, FieldUsageStats, FieldUsageTable } from '../../../../field-usage/fieldUsageTypes.js';
import FieldUsageMultiStageOutput, {
  DESCRIBE_STAGE,
  FIELD_STAGE,
  MultiStageData,
  OUTPUT_STAGE,
} from '../../../../field-usage/fieldUsageMultiStage.js';
import { resultFormatFlag, ResultFormats } from '../../../../common/jscSfCommandFlags.js';
import HumanResultsReporter from '../../../../common/reporters/humanResultsReporter.js';
import ResultsReporter from '../../../../common/reporters/resultsReporter.js';
import MarkdownResultsReporter from '../../../../common/reporters/markdownResultsReporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  sobjects: Record<string, FieldUsageTable>;
};

export default class JscMaintainFieldUsageAnalyse extends SfCommand<JscMaintainFieldUsageAnalyseResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description', [INCLUDED_FIELD_TYPES.join(', ')]);
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
    'check-defaults': Flags.boolean({
      summary: messages.getMessage('flags.check-defaults.summary'),
      description: messages.getMessage('flags.check-defaults.description'),
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
      description: messages.getMessage('flags.verbose.description'),
    }),
    'api-version': Flags.orgApiVersion(),
    'result-format': resultFormatFlag(),
  };

  private ms?: MultiStageOutput<MultiStageData>;

  public async run(): Promise<JscMaintainFieldUsageAnalyseResult> {
    const { flags } = await this.parse(JscMaintainFieldUsageAnalyse);
    const targetOrg = flags['target-org'].getConnection(flags['api-version']);
    if (flags['check-defaults']) {
      this.info(messages.getMessage('infos.check-defaults-enabled'));
    }
    const fieldUsageTables: Record<string, FieldUsageTable> = {};
    for (const sobj of flags.sobject) {
      this.ms = FieldUsageMultiStageOutput.create(sobj, flags.json);
      try {
        const analyser = await SObjectAnalyser.create(targetOrg, sobj);
        analyser.on(
          'describeSuccess',
          (data: { fieldCount: number; resolvedName: string; skippedFieldsCount: number }) => {
            this.ms?.updateData({ describeStatus: 'Success' });
            this.ms?.updateData({
              fieldsUnderAnalysis: `Running analysis for ${data.fieldCount} fields`,
              skippedFields: `Ignoring ${data.skippedFieldsCount} fields for analysis`,
            });
          }
        );
        analyser.on('totalRecordsRetrieve', (data: { totalCount: number }) => {
          this.ms?.updateData({ totalRecords: `${data.totalCount}` });
          if (data.totalCount > 0) {
            this.ms?.goto(FIELD_STAGE);
          } else {
            this.ms?.skipTo(OUTPUT_STAGE);
          }
        });
        this.ms.goto(DESCRIBE_STAGE);
        const sobjectUsageResult = await analyser.analyseFieldUsage({
          customFieldsOnly: flags['custom-fields-only'],
          excludeFormulaFields: flags['exclude-formulas'],
          checkDefaultValues: flags['check-defaults'],
        });
        this.ms.goto(OUTPUT_STAGE);
        fieldUsageTables[sobj] = sobjectUsageResult;
        this.ms.stop('completed');
        if (sobjectUsageResult.analysedFields.length > 0) {
          this.printResults(sobjectUsageResult.analysedFields, flags['result-format']);
        }
        if (flags.verbose && sobjectUsageResult.skippedFields.length > 0) {
          this.printIgnoredFields(sobjectUsageResult.skippedFields, flags['result-format']);
        }
      } catch (err) {
        this.ms.error();
        this.error(String(err));
      }
    }
    return { sobjects: fieldUsageTables };
  }

  private printResults(data: FieldUsageStats[], resultFormat: ResultFormats): void {
    const dataFormatted = data.map((field) => {
      const result = {
        ...field,
        percentFormatted: field.percentagePopulated.toLocaleString(undefined, {
          style: 'percent',
          minimumFractionDigits: 2,
        }),
      };
      return result;
    });
    let reporter: ResultsReporter<FieldUsageStats>;
    switch (resultFormat) {
      case ResultFormats.human:
        reporter = new HumanResultsReporter<FieldUsageStats>(dataFormatted, {
          excludeColumns: ['percentagePopulated'],
          title: 'Analysed Fields',
          jsonEnabled: this.jsonEnabled(),
        });
        reporter.print();
        break;
      case ResultFormats.markdown: {
        reporter = new MarkdownResultsReporter<FieldUsageStats>(dataFormatted, {
          formattings: { name: { style: 'code' } },
          capitalizeHeaders: true,
          title: 'Analysed Fields',
          excludeColumns: ['percentagePopulated'],
          jsonEnabled: this.jsonEnabled(),
        });
        reporter.print();
        break;
      }
      case ResultFormats.csv: {
        const csvOutput = json2csv(dataFormatted);
        this.log(csvOutput);
        break;
      }
    }
  }

  private printIgnoredFields(data: FieldSkippedInfo[], resultFormat: ResultFormats): void {
    let reporter: ResultsReporter<FieldSkippedInfo>;
    switch (resultFormat) {
      case ResultFormats.human:
        reporter = new HumanResultsReporter<FieldSkippedInfo>(data, {
          title: 'Skipped Fields',
          jsonEnabled: this.jsonEnabled(),
        });
        reporter.print();
        break;
      case ResultFormats.markdown: {
        reporter = new MarkdownResultsReporter<FieldSkippedInfo>(data, {
          formattings: { name: { style: 'code' } },
          capitalizeHeaders: true,
          title: 'Skipped Fields',
          jsonEnabled: this.jsonEnabled(),
        });
        reporter.print();
        break;
      }
      case ResultFormats.csv: {
        const csvOutput = json2csv(data);
        this.log(csvOutput);
        break;
      }
    }
  }
}
