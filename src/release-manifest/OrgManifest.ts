import { Connection } from '@salesforce/core';
import { ZReleaseManifestType } from '../types/orgManifestInputSchema.js';
import { ZManifestDeployResultType } from '../types/orgManifestOutputSchema.js';
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
      this.deployJobs.push(new ArtifactDeployJob(artifactName, artifact, this.data.options));
    }
  }

  public getEnvironmentName(targetUsername: string): string | undefined {
    return this.environmentsMap.get(targetUsername);
  }

  public getDeployJobs(): ArtifactDeployJob[] {
    return this.deployJobs;
  }

  public async rollout(targetOrg: Connection, devhubOrg: Connection): Promise<ZManifestDeployResultType> {
    const result: ZManifestDeployResultType = {};
    for (const element of this.getDeployJobs()) {
      // eslint-disable-next-line no-await-in-loop
      result[element.name] = await element.resolve(targetOrg, devhubOrg);
    }
    return result;
  }
}
