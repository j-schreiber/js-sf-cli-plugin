export enum ObjectStatus {
  Started,
  InProgress,
  Completed,
}

export type PlanObjectEvent = {
  message?: string;
  status: ObjectStatus;
  objectName: string;
  totalBatches: number;
  batchesCompleted: number;
  totalRecords: number;
  files: string[];
};
