import { EventEmitter } from 'node:events';
import { Connection } from '@salesforce/core';
import { Record } from '@jsforce/jsforce-node';
import { CommandStatusEvent, ProcessingStatus } from '../comms/processingEvents.js';

export default class QueryRunner extends EventEmitter {
  public constructor(private readonly orgConnection: Connection | Connection['tooling']) {
    super();
  }

  public async fetchRecords<T extends Record>(queryString: string): Promise<T[]> {
    this.emit('queryProgress', {
      message: 'placeholder',
      status: ProcessingStatus.Started,
    } as CommandStatusEvent);
    const queryResult = await this.orgConnection.query<T>(queryString, { autoFetch: true, maxFetch: 50_000 });
    this.emit('queryProgress', {
      message: 'placeholder',
      status: ProcessingStatus.Completed,
    } as CommandStatusEvent);
    return queryResult.records;
  }
}
