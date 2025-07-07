import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Messages } from '@salesforce/core';

export const DESCRIBE_STAGE = 'Analyse SObject';
export const FIELD_STAGE = 'Analyse Fields';
export const OUTPUT_STAGE = 'Format Output';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export default class FieldUsageMultiStageOutput {
  /**
   * This pattern allows to stub multi-stage outputs in tests to mute output
   * to stdout during test execution.
   *
   * In your code, create a new instance like this
   * ```
   * const ms = FieldUsageMultiStageOutput.newInstance(sobj, flags.json);
   * ```
   *
   * @param objectName
   * @param jsonEnabled
   * @returns
   */
  public static create(objectName: string, jsonEnabled?: boolean): MultiStageOutput<MultiStageData> {
    return new MultiStageOutput<MultiStageData>({
      jsonEnabled: jsonEnabled ?? false,
      stages: [DESCRIBE_STAGE, FIELD_STAGE, OUTPUT_STAGE],
      stageSpecificBlock: [
        {
          get: (data) => data?.describeStatus,
          stage: DESCRIBE_STAGE,
          type: 'dynamic-key-value',
          label: 'Describe',
        },
        {
          get: (data) => data?.totalRecords,
          stage: DESCRIBE_STAGE,
          type: 'dynamic-key-value',
          label: 'Total records',
        },
        {
          get: (data) => data?.fieldsUnderAnalysis,
          stage: FIELD_STAGE,
          type: 'message',
        },
        {
          get: (data) => data?.skippedFields,
          stage: FIELD_STAGE,
          type: 'message',
        },
      ],
      title: `Analyse ${objectName}`,
      postStagesBlock: [
        {
          label: 'Analysing default values',
          type: 'static-key-value',
          get: (data) => (data?.analyseDefaults ? messages.getMessage('infos.check-defaults-enabled') : undefined),
        },
        {
          label: 'Analysing history',
          type: 'static-key-value',
          get: (data) => (data?.analyseHistory ? messages.getMessage('infos.check-history-enabled') : undefined),
        },
        {
          label: 'Total queries executed',
          type: 'static-key-value',
          get: (data): string | undefined => (data?.totalQueries ? `${data.totalQueries}` : undefined),
        },
      ],
    });
  }
}

export type MultiStageData = {
  fieldCount: string;
  totalRecords: string;
  fieldsUnderAnalysis: string;
  skippedFields: string;
  describeStatus: string;
  analyseDefaults: boolean;
  analyseHistory: boolean;
  totalQueries: number;
};
