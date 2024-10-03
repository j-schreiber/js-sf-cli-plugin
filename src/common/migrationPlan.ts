/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import { MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import { eventBus } from './comms/eventBus.js';
import { PlanObjectEvent, PlanObjectValidationEvent, ProcessingStatus } from './comms/processingEvents.js';

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: MigrationPlanData, public org: Org) {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData, org.getConnection()));
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

  public async execute(outputDir?: string): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    const exportPath: string = this.prepareOutputDir(outputDir);
    for (const planObject of this.getObjects()) {
      eventBus.emit('planObjectEvent', {
        status: ProcessingStatus.Started,
        totalBatches: 10,
        batchesCompleted: 0,
        objectName: planObject.getObjectName(),
      } as PlanObjectEvent);
      const objectResults = await planObject.retrieveRecords(exportPath);
      eventBus.emit('planObjectEvent', {
        status: ProcessingStatus.Completed,
        totalBatches: 10,
        batchesCompleted: 10,
        totalRecords: objectResults.totalSize,
        files: objectResults.files,
        objectName: planObject.getObjectName(),
      } as PlanObjectEvent);
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