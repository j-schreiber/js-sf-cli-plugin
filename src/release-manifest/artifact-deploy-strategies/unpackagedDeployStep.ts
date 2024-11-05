/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */

import { Connection, Messages, SfError } from '@salesforce/core';
import OrgManifest from '../OrgManifest.js';
import OclifUtils from '../../common/utils/wrapChildprocess.js';
import { ZSourceDeployResultType } from '../../types/orgManifestOutputSchema.js';
import { ZUnpackagedSourceArtifact } from '../../types/orgManifestInputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

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

  public async deploy(): Promise<ZSourceDeployResultType> {
    if (this.internalState.status === DeployStatus.Enum.Skipped) {
      return this.internalState;
    }
    const result = await OclifUtils.execCoreCommand({ name: 'project:deploy:start', args: this.buildCommandArgs() });
    this.internalState.status = result.status === 0 ? DeployStatus.Enum.Success : DeployStatus.Enum.Failed;
    if (result.status !== 0) {
      this.internalState.errorDetails = result.result;
    }
    return this.internalState;
  }

  public async resolve(targetOrg: Connection): Promise<ZSourceDeployResultType> {
    this.internalState.targetUsername = targetOrg.getUsername();
    this.internalState.sourcePath = this.resolveDeployPath(this.artifact.path, targetOrg.getUsername());
    this.internalState.status = this.internalState.sourcePath ? DeployStatus.Enum.Resolved : DeployStatus.Enum.Skipped;
    this.internalState.displayMessage = this.getDeployMessage();
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
      return `Skipping step, because no path was resolved for username ${this.internalState.targetUsername}`;
    }
    return undefined;
  }

  private buildCommandArgs(): string[] {
    return [
      '--target-org',
      this.internalState.targetUsername!,
      '--source-dir',
      this.internalState.sourcePath!,
      '--wait',
      '10',
    ];
  }
}
