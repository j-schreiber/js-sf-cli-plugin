/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection } from '@salesforce/core';
import { ArtifactDeployResult } from '../manifestRolloutResult.js';
import { DeployStrategies, ZUnpackagedSourceArtifact } from '../../types/releaseManifest.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';
import ArtifactDeployJobStep from './artifactDeployJobStep.js';

export default class UnpackagedDeployStep extends ArtifactDeployJobStep implements ArtifactDeployStrategy {
  public sourcePath?: string;

  public constructor(public config: ZUnpackagedSourceArtifact) {
    super(DeployStrategies.Enum.SourceDeploy);
  }

  public async deploy(targetOrg: Connection): Promise<ArtifactDeployResult> {
    console.log(`Deploying: ${this.sourcePath}`);
    console.log(`Target Org: ${targetOrg.getUsername()}`);
    const res: ArtifactDeployResult = {
      name: 'test',
      sourcePath: this.sourcePath,
      deployStrategy: 'SourceDeploy',
    };
    return res;
  }

  public resolve(targetOrg: Connection, devhubOrg: Connection): void {
    // resolve source path together with target org & envs
    console.log(`Resolving with: ${devhubOrg.getUsername()!}`);
  }
}
