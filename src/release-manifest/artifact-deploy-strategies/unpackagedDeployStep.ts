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

  /*
  private resolveDeployPath(
    manifestInput: string | Record<string, string>,
    targetOrgConn: Connection
  ): string | undefined {
    if (typeof manifestInput === 'string') {
      return manifestInput;
    } else {
      if (this.data.environments === undefined) {
        throw new Error('Environments undefined, but required');
      }
      // map environments from input as username -> env name
      // resolve path from input by env-name
      // in strict mode, enforce that an env is mapped relative to the target org
      // if not in strict mode, mapped environments are ignored if deployed to a different target org
      const envs = new Map<string, string>();
      Object.entries(this.data.environments).forEach(([key, value]) => {
        console.log(`Env key: ${key} has username: ${value}`);
        envs.set(value, key);
      });
      const manifestPaths = new Map(Object.entries(manifestInput));
      // console.log(`Target env username: ${targetOrgConn.getUsername()}`);
      const envName = envs.get(targetOrgConn.getUsername()!);
      // console.log(`Required env name: ${envName}`);
      const result = manifestPaths.get(envName!);
      // console.log(`Mapped path: ${result}`);
      return result;
    }
  }*/
}
