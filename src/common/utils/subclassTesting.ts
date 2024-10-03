/* eslint-disable no-await-in-loop */
import { sleep } from '@salesforce/kit';
import { eventBus } from '../comms/eventBus.js';

export type TestQueryResult = {
  totalSize: number;
};

export enum ProcessingStatus {
  Started,
  Completed,
  InProgress,
}

export type PlanObjectEvent = {
  message: string;
  status: ProcessingStatus;
  objectName: string;
  totalBatches: number;
  batchesCompleted: number;
};

export default class SubclassTesting {
  // Emit the custom event with a message
  public static async simulateObjectExecution(iteration: number, objectName: string): Promise<void> {
    eventBus.emit('planObjectEvent', {
      message: `Total batches to retrieve: ${iteration}`,
      status: ProcessingStatus.Started,
      totalBatches: iteration,
      batchesCompleted: 0,
      objectName,
    });
    const result = await this.simulateRecordQuery(iteration);
    eventBus.emit('planObjectEvent', {
      message: `Total records retrieved: ${result.totalSize}`,
      status: ProcessingStatus.Completed,
      totalBatches: iteration,
      batchesCompleted: iteration,
      objectName,
    });
  }

  public static async simulateRecordQuery(batchCount: number): Promise<TestQueryResult> {
    for (let i = 0; i < batchCount; i++) {
      eventBus.emit('planObjectEvent', {
        message: 'Retrieved 1000 records.',
        status: ProcessingStatus.InProgress,
        batchesCompleted: i,
        totalBatches: batchCount,
      });
      await sleep(1000);
    }
    return { totalSize: batchCount * 1000 };
  }
}
