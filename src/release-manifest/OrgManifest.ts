import { Connection } from '@salesforce/core';
import { ZReleaseManifestType } from '../types/orgManifestInputSchema.js';
import { ZManifestDeployResultType } from '../types/orgManifestOutputSchema.js';
import { eventBus } from '../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../common/comms/processingEvents.js';
import ArtifactDeployJob from './artifact-deploy-strategies/artifactDeployJob.js';

export default class OrgManifest {
  private environmentsMap = new Map<string, string>();
  private deployJobs = new Array<ArtifactDeployJob>();

  public constructor(public data: ZReleaseManifestType) {
    if (this.data.environments) {
      Object.entries(this.data.environments).forEach(([key, value]) => {
        this.environmentsMap.set(value, key);
      });
    }
    for (const [artifactName, artifact] of Object.entries(this.data.artifacts)) {
      this.deployJobs.push(new ArtifactDeployJob(artifactName, artifact, this));
    }
  }

  /**
   * Searches mapped environments for a target org username and returns the
   * environment name. If no username is mapped, returns undefined.
   *
   * @param targetUsername The username of a target org, e.g. info@example.com
   * @returns The env name such as dev, prod, qa
   */
  public getEnvironmentName(targetUsername?: string): string | undefined {
    if (targetUsername === undefined) {
      return undefined;
    }
    return this.environmentsMap.get(targetUsername);
  }

  /**
   * Ordered list of all artifacts as deploy jobs. A job can contain
   * multiple steps.
   *
   * @returns
   */
  public getDeployJobs(): ArtifactDeployJob[] {
    return this.deployJobs;
  }

  /**
   * Aggregates all artifacts to determine, if the manifest requires an SFDX project
   *
   * @returns
   */
  public requiresProject(): boolean {
    for (const artifact of this.deployJobs) {
      if (artifact.requiresProject()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validates and resolves a manifest file.
   *
   * @param targetOrg
   * @param devhubOrg
   * @returns
   */
  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZManifestDeployResultType> {
    eventBus.emit('manifestRollout', {
      status: ProcessingStatus.Started,
      message: `Resolving manifest: ${this.deployJobs.length} artifacts found`,
    } as CommandStatusEvent);
    const result: ZManifestDeployResultType = {};
    for (const element of this.getDeployJobs()) {
      // need to check if we can go async here and await Promise.all() after loop
      // eslint-disable-next-line no-await-in-loop
      result[element.name] = await element.resolve(targetOrg, devhubOrg);
    }
    eventBus.emit('manifestRollout', {
      status: ProcessingStatus.Completed,
      message: 'Success! All artifacts resolved.',
    } as CommandStatusEvent);
    return result;
  }
}
