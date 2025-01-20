/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import { Connection } from '@salesforce/core';
import { MigrationPlanObjectQueryResult, ZMigrationPlanType } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import { eventBus } from './comms/eventBus.js';
import { CommandStatusEvent, PlanObjectValidationEvent, ProcessingStatus } from './comms/processingEvents.js';

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: ZMigrationPlanType, public sourceOrgConnection: Connection) {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData, sourceOrgConnection));
    });
  }

  public getName(): string {
    return this.data.name;
  }

  public async load(): Promise<MigrationPlan> {
    eventBus.emit('planValidationEvent', {
      status: ProcessingStatus.Started,
      planName: this.getName(),
      message: `Initialized plan with ${this.objects.length} objects.`,
    } as PlanObjectValidationEvent);
    for (const planObject of this.getObjects()) {
      eventBus.emit('planValidationEvent', {
        status: ProcessingStatus.InProgress,
        message: planObject.getObjectName(),
      } as PlanObjectValidationEvent);
      await planObject.load();
    }
    eventBus.emit('planValidationEvent', {
      status: ProcessingStatus.Completed,
      planName: this.getName(),
      message: 'Successfully completed validation.',
    } as PlanObjectValidationEvent);
    return this;
  }

  public getObjects(): MigrationPlanObject[] {
    return this.objects;
  }

  public async execute(outputDir?: string, validateOnly?: boolean): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    const exportPath: string = this.prepareOutputDir(outputDir);
    for (const planObject of this.getObjects()) {
      eventBus.emit('planObjectStatus', {
        status: ProcessingStatus.Started,
        message: `Starting ${planObject.getObjectName()}`,
      } as CommandStatusEvent);
      let objectResults: MigrationPlanObjectQueryResult;
      if (validateOnly) {
        objectResults = await planObject.getResult();
      } else {
        objectResults = await planObject.retrieveRecords(exportPath);
      }
      eventBus.emit('planObjectStatus', {
        status: ProcessingStatus.Completed,
        message: `Retrieved ${objectResults.totalSize} records in ${objectResults.executedFullQueryStrings.length} batches.`,
      } as CommandStatusEvent);
      results.push(objectResults);
    }
    return results;
  }

  private prepareOutputDir(userInput?: string): string {
    let exportPath;
    if (userInput) {
      exportPath = userInput;
    } else {
      exportPath = `exports/${this.getName().toLocaleLowerCase().replaceAll(' ', '-')}`;
    }
    fs.rmSync(exportPath, { recursive: true, force: true });
    fs.mkdirSync(exportPath, { recursive: true });
    return exportPath;
  }
}
