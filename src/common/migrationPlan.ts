/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import { MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import ValidationResult from './validationResult.js';
import { eventBus } from './comms/eventBus.js';
import { PlanObjectEvent, ObjectStatus } from './comms/processingEvents.js';

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
    for (const planObject of this.getObjects()) {
      await planObject.load();
    }
    return this;
  }

  public getObjects(): MigrationPlanObject[] {
    return this.objects;
  }

  public selfCheck(): ValidationResult {
    const res: ValidationResult = new ValidationResult();
    res.infos.push(`Found ${this.objects.length} objects.`);
    return res;
  }

  public async execute(outputDir?: string): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    const exportPath: string = this.prepareOutputDir(outputDir);
    for (const planObject of this.getObjects()) {
      eventBus.emit('planObjectEvent', {
        status: ObjectStatus.Started,
        totalBatches: 10,
        batchesCompleted: 0,
        objectName: planObject.getObjectName(),
      } as PlanObjectEvent);
      const objectResults = await planObject.retrieveRecords(exportPath);
      eventBus.emit('planObjectEvent', {
        status: ObjectStatus.Completed,
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
