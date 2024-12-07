/* eslint-disable camelcase */
import EventEmitter from 'node:events';
import { Connection } from '@salesforce/core';
import { ZAggregatedArtifactResult, ZArtifactDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZArtifactType } from '../../types/orgManifestInputSchema.js';
import OrgManifest from '../OrgManifest.js';
import { eventBus } from '../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../common/comms/processingEvents.js';
import { DeployStatus } from '../../types/orgManifestGlobalConstants.js';
import UnpackagedDeployStep from './unpackagedDeployStep.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';
import UnlockedPackageInstallStep from './unlockedPackageInstallStep.js';

export default class ArtifactDeployJob extends EventEmitter {
  public skipAll = false;
  private deploySteps: ArtifactDeployStrategy[] = [];

  public constructor(public name: string, public definition: ZArtifactType, private parentManifest: OrgManifest) {
    super();
    switch (this.definition.type) {
      case 'Unpackaged':
        this.deploySteps.push(new UnpackagedDeployStep(this.definition, this.parentManifest));
        break;
      case 'UnlockedPackage':
        this.deploySteps.push(new UnlockedPackageInstallStep(this.definition, this.parentManifest.data.options));
        break;
      default:
        break;
    }
  }

  /**
   * Prepares the artifact to be deployed against the target org. Resolves
   * version literals, checks integrity of ids, loads source paths, etc.
   *
   * @param targetOrg
   * @param devhubOrg
   */
  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZArtifactDeployResultType[]> {
    this.emitResolveInProgress(`Resolving ${this.name}`);
    const results: ZArtifactDeployResultType[] = [];
    for (const element of this.getSteps()) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await element.resolve(targetOrg, devhubOrg));
    }
    this.emitResolveInProgress(`Completed ${this.name}`);
    return results;
  }

  /**
   * Deploys all steps in this artifact. Must have been resolved first.
   * If artifact is set to be skipped, no steps are executed.
   *
   * @returns
   */
  public async deploy(): Promise<ZArtifactDeployResultType[]> {
    let isFailing = false;
    let failDetails;
    const results = new Array<ZArtifactDeployResultType>();
    this.emitDeployStart(`Rolling out ${this.name} (${this.deploySteps.length} steps).`);
    for (const deployStep of this.deploySteps) {
      const i = this.deploySteps.indexOf(deployStep) + 1;
      const stepStatus = deployStep.getStatus() as ZArtifactDeployResultType;
      this.emitDeployProgress(`Running ${stepStatus.deployStrategy} (Step ${i} of ${this.deploySteps.length})`);
      if (!isFailing && !this.skipAll) {
        // eslint-disable-next-line no-await-in-loop
        const stepResult = await deployStep.deploy();
        if (stepResult.status === DeployStatus.Enum.Failed) {
          isFailing = true;
          failDetails = stepResult.errorDetails;
        }
        results.push(stepResult);
      } else {
        stepStatus.status = DeployStatus.Enum.Skipped;
        stepStatus.displayMessage =
          isFailing && !this.skipAll
            ? 'Skipped, because the previous step failed'
            : 'Skipped, because a previous artifact failed.';
        results.push(stepStatus);
      }
    }
    if (isFailing) {
      this.emitDeployFailed(failDetails);
    } else {
      this.emitDeployCompleted(this.getAggregatedStatus().message!);
    }
    return results;
  }

  /**
   * Returns the aggregated status of all steps (the highest).
   * If all steps succeeded, the job succeeded. If one step failed,
   * the job failed. If all steps skipped, the job skipped.
   */
  public getAggregatedStatus(): ZAggregatedArtifactResult {
    let ordinalStatusValue = 0;
    const msgs: string[] = [];
    this.getStepStatus().forEach((stepStatus) => {
      if (stepStatus.displayMessage) {
        msgs.push(stepStatus.displayMessage);
      }
      const intValue = DeployStatus.options.indexOf(stepStatus.status!);
      if (intValue > ordinalStatusValue) {
        ordinalStatusValue = intValue;
      }
    });
    return { status: DeployStatus.options[ordinalStatusValue], message: msgs.join(', ') };
  }

  /**
   * List of all status of the artifacts steps
   *
   * @returns
   */
  public getStepStatus(): Array<Partial<ZArtifactDeployResultType>> {
    const stepStatus = new Array<Partial<ZArtifactDeployResultType>>();
    for (const deployStep of this.deploySteps) {
      stepStatus.push(deployStep.getStatus());
    }
    return stepStatus;
  }

  /**
   * Aggregates all steps to determine, if this job requires an SFDX project
   *
   * @returns
   */
  public requiresProject(): boolean {
    for (const step of this.getSteps()) {
      if (step.requiresSfdxProject) {
        return true;
      }
    }
    return false;
  }

  //              PRIVATE ZONE

  public getSteps(): ArtifactDeployStrategy[] {
    return this.deploySteps;
  }

  private emitResolveInProgress(message: string): void {
    eventBus.emit('manifestRollout', {
      status: ProcessingStatus.InProgress,
      message,
    } as CommandStatusEvent);
    this.emit('artifactStatus', { status: ProcessingStatus.InProgress, message } as CommandStatusEvent);
  }

  private emitDeployStart(message: string): void {
    this.emit('artifactDeployStart', { status: ProcessingStatus.Started, message } as CommandStatusEvent);
  }

  private emitDeployProgress(message: string): void {
    this.emit('artifactDeployProgress', { status: ProcessingStatus.InProgress, message } as CommandStatusEvent);
  }

  private emitDeployCompleted(message: string): void {
    this.emit('artifactDeployCompleted', {
      status: ProcessingStatus.Completed,
      message,
      exitCode: 0,
    } as CommandStatusEvent);
  }

  private emitDeployFailed(failDetails: unknown): void {
    this.emit('artifactDeployCompleted', {
      status: ProcessingStatus.Completed,
      message: 'Failed with errors',
      exitDetails: failDetails,
      exitCode: 2,
    } as CommandStatusEvent);
  }
}
