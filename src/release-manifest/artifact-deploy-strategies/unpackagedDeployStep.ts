/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection, Messages, SfError } from '@salesforce/core';
import OrgManifest from '../OrgManifest.js';
import { ZSourceDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZUnpackagedSourceArtifact } from '../../types/orgManifestInputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ArtifactDeployStrategy, SfCommandConfig } from './artifactDeployStrategy.js';

const messages = Messages.loadMessages('jsc', 'orgmanifest');

export default class UnpackagedDeployStep implements ArtifactDeployStrategy {
  private internalState: ZSourceDeployResultType;

  public constructor(private artifact: ZUnpackagedSourceArtifact, private manifest: OrgManifest) {
    this.internalState = {
      status: DeployStatus.Enum.Pending,
      deployStrategy: DeployStrategies.Enum.SourceDeploy,
    };
  }

  public getStatus(): Partial<ZSourceDeployResultType> {
    return this.internalState;
  }

  public getCommandConfig(): SfCommandConfig {
    const displayMsg = this.getDeployMessage();
    if (this.internalState.status !== DeployStatus.Enum.Resolved) {
      return { displayMessage: displayMsg, args: [] };
    }
    return {
      name: 'project:deploy:start',
      args: [
        '--target-org',
        this.internalState.targetUsername!,
        '--source-dir',
        this.internalState.sourcePath!,
        '--wait',
        '10',
      ],
      displayMessage: displayMsg,
    };
  }

  public async resolve(targetOrg: Connection): Promise<ZSourceDeployResultType> {
    this.internalState.targetUsername = targetOrg.getUsername();
    this.internalState.sourcePath = this.resolveDeployPath(this.artifact.path, targetOrg.getUsername());
    this.internalState.status = this.internalState.sourcePath ? DeployStatus.Enum.Resolved : DeployStatus.Enum.Skipped;
    return this.internalState;
  }

  //    PRIVATE ZONE

  private resolveDeployPath(
    manifestInput: string | Record<string, string>,
    targetUsername?: string
  ): string | undefined {
    if (typeof manifestInput === 'string') {
      return manifestInput;
    } else {
      const envName = this.manifest.getEnvironmentName(targetUsername);
      if (this.manifest.data.options.strict_environments && envName === undefined) {
        throw new SfError(messages.getMessage('no-env-configured-with-strict-validation', [targetUsername]));
      }
      if (envName === undefined) {
        return undefined;
      }
      return manifestInput[envName];
    }
  }

  private getDeployMessage(): string | undefined {
    if (this.internalState.status === DeployStatus.Enum.Resolved) {
      return `Running "sf project deploy start" with ${this.internalState.sourcePath} on ${this.internalState.targetUsername}`;
    } else if (this.internalState.status === DeployStatus.Enum.Skipped) {
      return `Skipping artifact, because no path was resolved for username ${this.internalState.targetUsername}`;
    }
    return undefined;
  }
}
