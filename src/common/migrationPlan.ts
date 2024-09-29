/* eslint-disable no-await-in-loop */
import fs from 'node:fs';
import { Org } from '@salesforce/core';
import { MigrationPlanData } from '../types/migrationPlanData.js';
import { MigrationPlanObjectQueryResult } from '../types/migrationPlanObjectData.js';
import MigrationPlanObject from './migrationPlanObject.js';
import ValidationResult from './validationResult.js';

export default class MigrationPlan {
  private objects: MigrationPlanObject[] = [];

  public constructor(public data: MigrationPlanData, public org: Org) {
    this.data.objects.forEach((objectData) => {
      this.objects.push(new MigrationPlanObject(objectData, org.getConnection()));
    });
  }

  private static prepareOutputDir(userInput?: string): string {
    let exportPath;
    if (userInput) {
      exportPath = `${userInput}/exports`;
    } else {
      exportPath = 'exports';
    }
    fs.rmSync(exportPath, { recursive: true, force: true });
    fs.mkdirSync(exportPath, { recursive: true });
    return exportPath;
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
    for (const planObject of this.getObjects()) {
      try {
        planObject.selfCheck();
      } catch (err) {
        res.errors.push(`Error validating plan object ${planObject.getObjectName()}: ${String(err)}`);
      }
    }
    return res;
  }

  public async execute(outputDir?: string): Promise<MigrationPlanObjectQueryResult[]> {
    const results: MigrationPlanObjectQueryResult[] = [];
    const exportPath: string = MigrationPlan.prepareOutputDir(outputDir);
    for (const planObject of this.getObjects()) {
      const objectResults = await planObject.retrieveRecords(exportPath);
      results.push(objectResults);
    }
    return results;
  }
}
