/* eslint-disable camelcase */
import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZArtifactType } from '../../types/orgManifestInputSchema.js';
import OrgManifest from '../OrgManifest.js';
import { eventBus } from '../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../common/comms/processingEvents.js';
import { DeployStatus } from '../../types/orgManifestGlobalConstants.js';
import UnpackagedDeployStep from './unpackagedDeployStep.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';
import UnlockedPackageInstallStep from './unlockedPackageInstallStep.js';

export default class ArtifactDeployJob {
  private deploySteps: ArtifactDeployStrategy[] = [];

  public constructor(public name: string, public definition: ZArtifactType, private parentManifest: OrgManifest) {}

  /**
   * Prepares the artifact to be deployed against the target org. Resolves
   * version literals, checks integrity of ids, loads source paths, etc.
   *
   * @param targetOrg
   * @param devhubOrg
   */
  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZArtifactDeployResultType[]> {
    eventBus.emit('manifestRollout', {
      status: ProcessingStatus.InProgress,
      message: `Resolving ${this.name}`,
    } as CommandStatusEvent);
    const results: ZArtifactDeployResultType[] = [];
    for (const element of this.getSteps()) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await element.resolve(targetOrg, devhubOrg));
    }
    eventBus.emit('manifestRollout', {
      status: ProcessingStatus.InProgress,
      message: `Completed ${this.name}`,
    } as CommandStatusEvent);
    return results;
  }

  /**
   * Returns the aggregated status of all steps (the highest).
   * If all steps succeeded, the job succeeded. If one step failed,
   * the job failed. If all steps skipped, the job skipped.
   */
  public getAggregatedStatus(): string {
    let ordinalStatusValue = 0;
    this.getSteps().forEach((step) => {
      const stepStatus = step.getStatus().status!;
      const intValue = DeployStatus.options.indexOf(stepStatus);
      if (intValue > ordinalStatusValue) {
        ordinalStatusValue = intValue;
      }
    });
    return DeployStatus.options[ordinalStatusValue];
  }

  public getSteps(): ArtifactDeployStrategy[] {
    if (this.deploySteps.length > 0) {
      return this.deploySteps;
    }
    // in the future, a single job can have multiple steps, e.g.
    // package artifact: install package, then remove deprecated components, then data cleanup
    // unpackaged artifact: deploy source, then delete removed source (destructive changes)
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
    return this.deploySteps;
  }
}
