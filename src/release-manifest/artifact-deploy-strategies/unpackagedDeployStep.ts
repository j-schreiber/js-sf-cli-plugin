/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection, Messages, SfError } from '@salesforce/core';
import OrgManifest from '../OrgManifest.js';
import { ZSourceDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZUnpackagedSourceArtifact } from '../../types/orgManifestInputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { eventBus } from '../../common/comms/eventBus.js';
import { CommandStatusEvent } from '../../common/comms/processingEvents.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

const messages = Messages.loadMessages('jsc', 'orgmanifest');

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
    if (this.internalState.status === DeployStatus.Enum.Pending) {
      await this.resolve(targetOrg);
    }
    this.emitDeployMessage(targetOrg.getUsername());
    if (this.internalState.status === DeployStatus.Enum.Resolved) {
      // this is where we delegate to sf project deploy start
      this.internalState.status = 'Success';
    }
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
        throw new SfError(messages.getMessage('no-env-configured-with-strict-validation', [targetUsername]));
      }
      if (envName === undefined) {
        return undefined;
      }
      return manifestInput[envName];
    }
  }

  private emitDeployMessage(username?: string): void {
    let msg;
    if (this.internalState.status === DeployStatus.Enum.Resolved) {
      msg = `Running "sf project deploy start" with ${this.internalState.sourcePath} on ${username}`;
    } else if (this.internalState.status === DeployStatus.Enum.Skipped) {
      msg = `Skipping artifact, because no path was resolved for username ${username}`;
    }
    eventBus.emit('simpleMessage', {
      message: msg,
    } as CommandStatusEvent);
  }
}
