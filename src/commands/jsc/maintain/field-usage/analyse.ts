/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import SObjectAnalyser, { INCLUDED_FIELD_TYPES } from '../../../../field-usage/sobjectAnalyser.js';
import { FieldSkippedInfo, FieldUsageStats, SObjectAnalysisResult } from '../../../../field-usage/fieldUsageTypes.js';
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
import CsvResultsReporter from '../../../../common/reporters/csvResultsReporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  [sobjectName: string]: SObjectAnalysisResult;
};

type FlagOptions = {
  'check-defaults': boolean;
  verbose: boolean;
  'result-format': ResultFormats;
  'segment-record-types': boolean;
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
    'check-history': Flags.boolean({
      summary: messages.getMessage('flags.check-history.summary'),
      description: messages.getMessage('flags.check-history.description'),
    }),
    'segment-record-types': Flags.boolean({
      summary: messages.getMessage('flags.segment-record-types.summary'),
      description: messages.getMessage('flags.segment-record-types.description'),
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
    const result: JscMaintainFieldUsageAnalyseResult = {};
    for (const sobj of flags.sobject) {
      this.ms = FieldUsageMultiStageOutput.create(sobj, flags.json);
      this.ms.updateData({ analyseDefaults: flags['check-defaults'] });
      this.ms.updateData({ analyseHistory: flags['check-history'] });
      this.ms.updateData({ segmentRecordTypes: flags['segment-record-types'] });
      try {
        const analyser = await SObjectAnalyser.create(targetOrg, sobj);
        analyser.on(
          'describeSuccess',
          (data: { fieldCount: number; skippedFieldsCount: number; recordTypesCount: number }) => {
            this.ms?.updateData({ describeStatus: 'Success' });
            this.ms?.updateData({
              fieldsUnderAnalysis: flags['segment-record-types']
                ? `Analysing ${data.fieldCount} fields for ${data.recordTypesCount} record types each`
                : `Analysing ${data.fieldCount} fields`,
              skippedFields: `Ignoring ${data.skippedFieldsCount} fields for analysis`,
              totalRecordTypes: `${data.recordTypesCount}`,
            });
          }
        );
        analyser.on('totalRecordsRetrieve', (data: { totalRecords: number }) => {
          this.ms?.updateData({ totalRecords: `${data.totalRecords}` });
          if (data.totalRecords > 0) {
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
          checkHistory: flags['check-history'],
          segmentRecordTypes: flags['segment-record-types'],
        });
        this.ms.goto(OUTPUT_STAGE);
        result[sobj] = sobjectUsageResult;
        this.ms.stop('completed');
        // also print record types summary?
        this.print(sobjectUsageResult, flags);
      } catch (err) {
        this.ms.error();
        this.error(String(err));
      }
    }
    return result;
  }

  private print(analyseResult: SObjectAnalysisResult, options: FlagOptions): void {
    if (options['segment-record-types']) {
      printSummary(analyseResult, options['result-format'], this.jsonEnabled());
    }
    for (const [recordType, result] of Object.entries(analyseResult.recordTypes)) {
      if (result.totalRecords === 0 && !options.verbose) {
        continue;
      }
      // if --segment-record-types is false, we'll have all records in "Master" anyway
      if (options['segment-record-types']) {
        this.log(`====== ${recordType} (${result.totalRecords} records) ======\n`);
      }
      this.printResults(result.analysedFields, options['result-format']);
      if (options.verbose && result.skippedFields.length > 0) {
        this.printIgnoredFields(result.skippedFields, options['result-format']);
      }
    }
  }

  private printResults(data: FieldUsageStats[], resultFormat: ResultFormats): void {
    const dataFormatted = data.map((field) => {
      const result = {
        ...field,
        percent: field.percentagePopulated.toLocaleString(undefined, {
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
        break;
      case ResultFormats.markdown: {
        reporter = new MarkdownResultsReporter<FieldUsageStats>(dataFormatted, {
          formattings: { name: { style: 'code' } },
          capitalizeHeaders: true,
          title: 'Analysed Fields',
          excludeColumns: ['percentagePopulated'],
          jsonEnabled: this.jsonEnabled(),
        });
        break;
      }
      case ResultFormats.csv: {
        reporter = new CsvResultsReporter<FieldUsageStats>(dataFormatted, {
          jsonEnabled: this.jsonEnabled(),
          excludeColumns: ['percentagePopulated'],
        });
        break;
      }
    }
    reporter.print();
  }

  private printIgnoredFields(data: FieldSkippedInfo[], resultFormat: ResultFormats): void {
    let reporter: ResultsReporter<FieldSkippedInfo>;
    switch (resultFormat) {
      case ResultFormats.human:
        reporter = new HumanResultsReporter<FieldSkippedInfo>(data, {
          title: 'Skipped Fields',
          jsonEnabled: this.jsonEnabled(),
        });
        break;
      case ResultFormats.markdown: {
        reporter = new MarkdownResultsReporter<FieldSkippedInfo>(data, {
          formattings: { name: { style: 'code' } },
          capitalizeHeaders: true,
          title: 'Skipped Fields',
          jsonEnabled: this.jsonEnabled(),
        });
        break;
      }
      case ResultFormats.csv: {
        reporter = new CsvResultsReporter<FieldSkippedInfo>(data, {
          jsonEnabled: this.jsonEnabled(),
        });
        break;
      }
    }
    reporter.print();
  }
}

function printSummary(analyseResult: SObjectAnalysisResult, resultFormat: ResultFormats, jsonEnabled: boolean): void {
  const rtSummary = new Array<RecordTypeSummary>();
  for (const [recordType, result] of Object.entries(analyseResult.recordTypes)) {
    rtSummary.push({ developerName: recordType, totalRecords: result.totalRecords, isActive: result.isActive });
  }
  rtSummary.sort((a, b) => a.totalRecords - b.totalRecords);
  let reporter: ResultsReporter<RecordTypeSummary>;
  switch (resultFormat) {
    case ResultFormats.human:
      reporter = new HumanResultsReporter<RecordTypeSummary>(rtSummary, {
        title: 'Record Types',
        jsonEnabled,
      });
      break;
    case ResultFormats.markdown: {
      reporter = new MarkdownResultsReporter<RecordTypeSummary>(rtSummary, {
        formattings: { name: { style: 'code' } },
        capitalizeHeaders: true,
        title: 'Record Types',
        jsonEnabled,
      });
      break;
    }
    case ResultFormats.csv: {
      reporter = new CsvResultsReporter<RecordTypeSummary>(rtSummary, {
        jsonEnabled,
      });
      break;
    }
  }
  reporter.print();
}

type RecordTypeSummary = {
  developerName: string;
  totalRecords: number;
  isActive: boolean;
};
