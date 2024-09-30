export enum ProcessingStatus {
  Started,
  InProgress,
  Completed,
}

export type PlanObjectEvent = {
  message?: string;
  status: ProcessingStatus;
  objectName: string;
  totalBatches: number;
  batchesCompleted: number;
  totalRecords: number;
  files: string[];
};

export type PlanObjectValidationEvent = {
  status: ProcessingStatus;
  objectName: string;
  planName: string;
};
