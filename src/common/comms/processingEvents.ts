export enum ProcessingStatus {
  Started,
  InProgress,
  Completed,
}

export type CommandStatusEvent = {
  status: ProcessingStatus;
  message?: string;
  exitCode?: number;
  exitDetails?: unknown;
};

export type PlanObjectEvent = CommandStatusEvent & {
  objectName: string;
  totalBatches: number;
  batchesCompleted: number;
  totalRecords: number;
  files: string[];
};

export type PlanObjectValidationEvent = CommandStatusEvent & {
  objectName: string;
  planName: string;
};
