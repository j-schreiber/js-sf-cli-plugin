import { MultiStageOutput } from '@oclif/multi-stage-output';

export const DESCRIBE_STAGE = 'Analyse SObject';
export const FIELD_STAGE = 'Analyse Fields';
export const OUTPUT_STAGE = 'Format Output';

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
  public static newInstance(objectName: string, jsonEnabled?: boolean): MultiStageOutput<MultiStageData> {
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
      ],
      title: `Analyse ${objectName}`,
    });
  }
}

export type MultiStageData = {
  fieldCount: string;
  totalRecords: string;
  fieldsUnderAnalysis: string;
  describeStatus: string;
};
