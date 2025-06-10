/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { env, isEmpty } from '@salesforce/kit';
import { Connection, Messages, SfError } from '@salesforce/core';
import OclifUtils from '../../common/utils/wrapChildprocess.js';
import { ZPackageInstallResultType } from '../../types/orgManifestOutputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ZManifestOptionsType, ZUnlockedPackageArtifact } from '../../types/orgManifestInputSchema.js';
import {
  PackageVersionDetails,
  resolveInstalledVersionId,
  resolvePackageVersionId,
} from '../../common/metadata/toolingApiHelper.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'orgmanifest');

export default class UnlockedPackageInstallStep implements ArtifactDeployStrategy {
  public requiresSfdxProject: boolean = false;
  private internalState: Partial<ZPackageInstallResultType>;

  public constructor(public artifact: ZUnlockedPackageArtifact, private globalOptions: ZManifestOptionsType) {
    this.internalState = {
      status: DeployStatus.Enum.Pending,
      requestedVersion: this.artifact.version,
      deployStrategy: DeployStrategies.Enum.PackageInstall,
      shouldSkipIfInstalled: artifact.skip_if_installed ?? this.globalOptions.skip_if_installed,
    };
  }

  public getStatus(): Partial<ZPackageInstallResultType> {
    return this.internalState;
  }

  public async deploy(): Promise<ZPackageInstallResultType> {
    if (this.internalState.status === DeployStatus.Enum.Skipped) {
      this.internalState.displayMessage = `Skipped. ${this.internalState.requestedVersion} (${this.internalState.requestedVersionId}) already installed.`;
      return this.internalState as ZPackageInstallResultType;
    }
    const result = await OclifUtils.execCoreCommand({ name: 'package:install', args: this.buildCommandArgs() });
    this.internalState.status = result.status === 0 ? DeployStatus.Enum.Success : DeployStatus.Enum.Failed;
    if (result.status !== 0) {
      this.internalState.errorDetails = result.result;
    }
    this.internalState.displayMessage = `Installed ${this.internalState.requestedVersion} (${this.internalState.requestedVersionId}).`;
    return this.internalState as ZPackageInstallResultType;
  }

  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZPackageInstallResultType> {
    this.internalState.targetUsername = targetOrg.getUsername();
    const versionDetails = await resolvePackageVersionId(
      this.internalState.requestedVersion!,
      this.artifact.package_id,
      devhubOrg
    );
    this.assertInstallationKey(versionDetails);
    this.internalState.requestedVersionId = versionDetails.id;
    const installedVersionDetails = await resolveInstalledVersionId(versionDetails.subscriberPackageId!, targetOrg);
    this.internalState.installedVersionId = installedVersionDetails.id;
    this.internalState.installedVersion = installedVersionDetails.versionName;
    if (this.isResolved()) {
      this.internalState.status = DeployStatus.Enum.Resolved;
      if (this.internalState.installedVersion) {
        this.internalState.displayMessage = `Installing ${this.internalState.requestedVersion} over ${this.internalState.installedVersion}`;
      } else {
        this.internalState.displayMessage = `Package not installed. Installing ${this.internalState.requestedVersion}`;
      }
    } else {
      this.internalState.status = DeployStatus.Enum.Skipped;
      this.internalState.displayMessage = `Installed version matches requested version (${this.internalState.installedVersion})`;
    }
    return this.internalState as ZPackageInstallResultType;
  }

  //      PRIVATE ZONE

  private isResolved(): boolean {
    return !(
      this.internalState.shouldSkipIfInstalled &&
      this.internalState.requestedVersionId === this.internalState.installedVersionId
    );
  }

  private assertInstallationKey(versionDetails: PackageVersionDetails): void {
    if (!versionDetails.requiresInstallationKey) {
      this.internalState.useInstallationKey = false;
      return;
    }
    if (versionDetails.requiresInstallationKey && isEmpty(this.artifact.installation_key)) {
      throw new SfError(
        messages.getMessage('errors.package-requires-install-key', [this.artifact.version, versionDetails.id]),
        'InstallationKeyRequired'
      );
    }
    if (!isEmpty(this.artifact.installation_key) && isEmpty(env.getString(this.artifact.installation_key!))) {
      throw new SfError(
        messages.getMessage('errors.install-key-defined-but-empty', [this.artifact.installation_key]),
        'InstallationKeyEmpty'
      );
    }
    this.internalState.useInstallationKey = true;
    this.internalState.installationKey = env.getString(this.artifact.installation_key!);
  }

  private buildCommandArgs(): string[] {
    const args = [
      '--target-org',
      this.internalState.targetUsername!,
      '--package',
      this.internalState.requestedVersionId!,
      '--wait',
      '10',
      '--no-prompt',
    ];
    if (this.internalState.useInstallationKey) {
      args.push(...['--installation-key', this.internalState.installationKey!]);
    }
    return args;
  }
}
