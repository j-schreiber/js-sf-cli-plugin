/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection, SfError } from '@salesforce/core';
import OrgManifest from '../OrgManifest.js';
import { ZSourceDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZUnpackagedSourceArtifact } from '../../types/orgManifestInputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnpackagedDeployStep implements ArtifactDeployStrategy {
  private internalState: Partial<ZSourceDeployResultType>;

  public constructor(private artifact: ZUnpackagedSourceArtifact, private manifest: OrgManifest) {
    this.internalState = {
      status: DeployStatus.Enum.Pending,
      deployStrategy: DeployStrategies.Enum.SourceDeploy,
    };
  }

  public getStatus(): Partial<ZSourceDeployResultType> {
    return this.internalState;
  }

  public async deploy(targetOrg: Connection): Promise<ZSourceDeployResultType> {
    console.log(`Target Org: ${targetOrg.getUsername()}`);
    this.internalState.status = 'Success';
    return this.internalState as ZSourceDeployResultType;
  }

  public async resolve(targetOrg: Connection): Promise<ZSourceDeployResultType> {
    this.internalState.sourcePath = this.resolveDeployPath(this.artifact.path, targetOrg.getUsername());
    this.internalState.status = this.internalState.sourcePath ? DeployStatus.Enum.Resolved : DeployStatus.Enum.Skipped;
    return this.internalState as ZSourceDeployResultType;
  }

  private resolveDeployPath(
    manifestInput: string | Record<string, string>,
    targetUsername?: string
  ): string | undefined {
    if (typeof manifestInput === 'string') {
      return manifestInput;
    } else {
      const envName = this.manifest.getEnvironmentName(targetUsername);
      if (this.manifest.data.options.strict_environments && envName === undefined) {
        throw new SfError(`No environment configured for target org ${targetUsername}, but strict validation was set.`);
      }
      if (envName === undefined) {
        return undefined;
      }
      return manifestInput[envName];
    }
  }
}
