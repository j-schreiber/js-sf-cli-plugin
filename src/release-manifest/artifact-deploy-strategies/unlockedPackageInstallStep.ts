/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable class-methods-use-this */
import { isEmpty } from '@salesforce/kit';
import { Connection, SfError } from '@salesforce/core';
import { ZPackageInstallResultType } from '../../types/orgManifestOutputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ZManifestOptionsType, ZUnlockedPackageArtifact } from '../../types/orgManifestInputSchema.js';
import { Package2Version, SubscriberPackageVersion } from '../../types/sfToolingApiTypes.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnlockedPackageInstallStep implements ArtifactDeployStrategy {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async deploy(targetOrg: Connection): Promise<ZPackageInstallResultType> {
    this.internalState.status = 'Success';
    return this.internalState as ZPackageInstallResultType;
  }

  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZPackageInstallResultType> {
    const versionDetails = await this.resolvePackageVersionId(
      this.internalState.requestedVersion!,
      this.artifact.package_id,
      devhubOrg
    );
    this.assertInstallationKey(versionDetails);
    this.internalState.requestedVersionId = versionDetails.id;
    const installedVersionDetails = await this.resolveInstalledVersionId(
      versionDetails.subscriberPackageId!,
      targetOrg
    );
    this.internalState.installedVersionId = installedVersionDetails.id;
    this.internalState.installedVersion = installedVersionDetails.versionName;
    this.internalState.status = this.isResolved() ? DeployStatus.Enum.Resolved : DeployStatus.Enum.Skipped;
    return this.internalState as ZPackageInstallResultType;
  }

  //      PRIVATE ZONE

  private isResolved(): boolean {
    return !(
      this.internalState.shouldSkipIfInstalled &&
      this.internalState.requestedVersionId === this.internalState.installedVersionId
    );
  }

  private async resolvePackageVersionId(
    packageVersionLiteral: string,
    packageId: string,
    devhubCon: Connection
  ): Promise<PackageVersionDetails> {
    const versionArray = packageVersionLiteral.split('.');
    const queryString = `SELECT 
      SubscriberPackageVersionId,
      Package2.SubscriberPackageId,
      SubscriberPackageVersion.IsBeta,
      SubscriberPackageVersion.IsPasswordProtected 
      FROM Package2Version 
      WHERE Package2Id = '${packageId}'
        AND MajorVersion = ${versionArray[0]} 
        AND MinorVersion = ${versionArray[1]} 
        AND PatchVersion = ${versionArray[2]} 
        AND IsReleased = true LIMIT 1`;
    const queryResult = await devhubCon.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      throw new SfError(
        `No released package version found for package id ${packageId} and version ${packageVersionLiteral}`
      );
    }
    const record = queryResult.records[0] as Package2Version;
    return {
      id: record.SubscriberPackageVersionId,
      requiresInstallationKey: record.SubscriberPackageVersion.IsPasswordProtected,
      subscriberPackageId: record.Package2.SubscriberPackageId,
    };
  }

  private async resolveInstalledVersionId(
    subscriberId: string,
    targetOrgCon: Connection
  ): Promise<PackageVersionDetails> {
    const queryString = `SELECT
      SubscriberPackageVersionId,
      SubscriberPackageVersion.MajorVersion,
      SubscriberPackageVersion.MinorVersion,
      SubscriberPackageVersion.PatchVersion,
      SubscriberPackageVersion.IsPasswordProtected
      FROM InstalledSubscriberPackage
      WHERE SubscriberPackageId = '${subscriberId}' LIMIT 1`;
    const queryResult = await targetOrgCon.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      return { id: undefined };
    }
    const record = queryResult.records[0] as Package2Version;
    return {
      id: record.SubscriberPackageVersionId,
      versionName: this.mergeVersionName(record.SubscriberPackageVersion),
      requiresInstallationKey: record.SubscriberPackageVersion.IsPasswordProtected,
    };
  }

  private mergeVersionName(subscriberPackage: SubscriberPackageVersion): string {
    return `${subscriberPackage.MajorVersion}.${subscriberPackage.MinorVersion}.${subscriberPackage.PatchVersion}`;
  }

  private assertInstallationKey(versionDetails: PackageVersionDetails): void {
    if (!versionDetails.requiresInstallationKey) {
      this.internalState.useInstallationKey = false;
      return;
    }
    if (versionDetails.requiresInstallationKey && isEmpty(this.artifact.installation_key)) {
      throw new SfError(`The package version ${
        this.artifact.version
      } (${versionDetails.id!}) requires an installation key, \
            but no key export was specified for the artifact. Specify the environment variable \
            that holds the installation key in the property installation_key.`);
    }
    if (!isEmpty(this.artifact.installation_key) && isEmpty(process.env[this.artifact.installation_key!])) {
      throw new SfError(
        `Installation key set to ${this.artifact.installation_key!}, \
          but the corresponding environment variable is not set.`
      );
    }
    this.internalState.useInstallationKey = true;
    this.internalState.installationKey = process.env[this.artifact.installation_key!];
  }
}

type PackageVersionDetails = {
  id?: string;
  versionName?: string;
  requiresInstallationKey?: boolean;
  subscriberPackageId?: string;
};
