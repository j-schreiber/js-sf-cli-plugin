import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType, ZArtifactType } from '../../types/releaseManifest.js';
import UnpackagedDeployStep from './unpackagedDeployStep.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';
import UnlockedPackageInstallStep from './unlockedPackageInstallStep.js';

export default class ArtifactDeployJob {
  public constructor(public name: string, private artifact: ZArtifactType) {}

  public getType(): string {
    return this.artifact.type;
  }

  /**
   * Prepares the artifact to be deployed against the target org. Resolves
   * version literals, checks integrity of ids, loads source paths, etc.
   *
   * @param targetOrg
   * @param devhubOrg
   */
  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZArtifactDeployResultType[]> {
    // resolve source path together with target org & envs
    const results: ZArtifactDeployResultType[] = [];
    for (const element of this.getSteps()) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await element.resolve(targetOrg, devhubOrg));
    }
    return results;
  }

  public getSteps(): ArtifactDeployStrategy[] {
    const steps = new Array<ArtifactDeployStrategy>();
    // a job may have multiple steps (like package install will have picklist fix after install)
    switch (this.artifact.type) {
      case 'Unpackaged':
        steps.push(new UnpackagedDeployStep(this.artifact));
        break;
      case 'UnlockedPackage':
        steps.push(new UnlockedPackageInstallStep(this.artifact));
        break;
      default:
        break;
    }
    return steps;
  }
}
