import { DeployStrategies, ZArtifactType } from '../../types/releaseManifest.js';
import ArtifactDeployJobStep from './artifactDeployJobStep.js';
import UnpackagedDeployStep from './unpackagedDeployStep.js';

export default class ArtifactDeployJob {
  public constructor(public name: string, private artifact: ZArtifactType) {}

  public getType(): string {
    return this.artifact.type;
  }

  public getSteps(): ArtifactDeployJobStep[] {
    const steps = new Array<ArtifactDeployJobStep>();
    // a job may have multiple steps (like package install will have picklist fix after install)
    switch (this.artifact.type) {
      case 'Unpackaged':
        steps.push(new UnpackagedDeployStep(this.artifact));
        break;
      case 'UnlockedPackage':
        steps.push(new ArtifactDeployJobStep(DeployStrategies.Enum.PackageInstall));
        break;
      default:
        break;
    }
    return steps;
  }
}
