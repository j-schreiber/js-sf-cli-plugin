export enum ProcessingStatus {
  Started,
  InProgress,
  Completed,
}

export type CommandStatusEvent = {
  message?: string;
  status: ProcessingStatus;
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
