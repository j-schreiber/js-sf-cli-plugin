/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection } from '@salesforce/core';
import { ZSourceDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZUnpackagedSourceArtifact } from '../../types/orgManifestInputSchema.js';
import { DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnpackagedDeployStep implements ArtifactDeployStrategy {
  private internalState: ZSourceDeployResultType;

  public constructor(private artifact: ZUnpackagedSourceArtifact) {
    this.internalState = {
      status: 'Pending',
      deployStrategy: DeployStrategies.Enum.SourceDeploy,
    };
  }

  public getStatus(): ZSourceDeployResultType {
    return this.internalState;
  }

  public async deploy(targetOrg: Connection): Promise<ZSourceDeployResultType> {
    console.log(`Target Org: ${targetOrg.getUsername()}`);
    this.internalState.status = 'Success';
    return this.internalState;
  }

  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZSourceDeployResultType> {
    // resolve source path together with target org & envs
    console.log(`Resolving: ${JSON.stringify(this.artifact)}`);
    console.log(`Dev Hub: ${devhubOrg.getUsername()!}`);
    console.log(`Target Org: ${targetOrg.getUsername()!}`);
    return this.internalState;
  }
}
