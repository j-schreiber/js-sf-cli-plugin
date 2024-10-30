/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable class-methods-use-this */
import { Connection, SfError } from '@salesforce/core';
import { ZPackageInstallResultType } from '../../types/orgManifestOutputSchema.js';
import { DeployStatus, DeployStrategies } from '../../types/orgManifestGlobalConstants.js';
import { ZManifestOptionsType, ZUnlockedPackageArtifact } from '../../types/orgManifestInputSchema.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnlockedPackageInstallStep implements ArtifactDeployStrategy {
  private internalState: ZPackageInstallResultType;

  public constructor(public artifact: ZUnlockedPackageArtifact, private globalOptions: ZManifestOptionsType) {
    this.internalState = {
      status: DeployStatus.Enum.Pending,
      version: this.artifact.version,
      deployStrategy: DeployStrategies.Enum.PackageInstall,
      shouldSkipIfInstalled: artifact.skip_if_installed ?? this.globalOptions.skip_if_installed,
    };
  }

  public getStatus(): ZPackageInstallResultType {
    return this.internalState;
  }

  public async deploy(targetOrg: Connection): Promise<ZPackageInstallResultType> {
    this.internalState.status = 'Success';
    return this.internalState;
  }

  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZPackageInstallResultType> {
    // verify package_id exists
    // version resolves to valid subscriber package version id
    const versionDetails = await this.resolvePackageVersionId(
      this.artifact.version,
      this.artifact.package_id,
      devhubOrg
    );
    this.internalState.versionId = versionDetails.id;
    const installedVersionDetails = await this.resolveInstalledVersionId(this.artifact.package_id, targetOrg);
    this.internalState.installedVersionId = installedVersionDetails.id;
    this.internalState.installedVersion = installedVersionDetails.versionName;
    this.internalState.skipped =
      this.artifact.skip_if_installed && this.internalState.versionId === this.internalState.installedVersionId;
    // package version requires installation key & is set
    // installation key (env var) is not empty
    return this.internalState;
  }

  private async resolvePackageVersionId(
    packageVersionLiteral: string,
    packageId: string,
    devhubCon: Connection
  ): Promise<PackageVersionDetails> {
    const versionArray = packageVersionLiteral.split('.');
    const queryString = `SELECT SubscriberPackageVersionId,SubscriberPackageVersion.IsBeta FROM Package2Version WHERE Package2Id = '${packageId}' AND MajorVersion = ${versionArray[0]} AND MinorVersion = ${versionArray[1]} AND PatchVersion = ${versionArray[2]} AND IsReleased = true LIMIT 1`;
    const queryResult = await devhubCon.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      throw new SfError(
        `No released package version found for package id ${packageId} and version ${packageVersionLiteral}`
      );
    }
    const record = queryResult.records[0] as Package2Version;
    return { id: record.SubscriberPackageVersionId };
  }

  private async resolveInstalledVersionId(packageId: string, targetOrgCon: Connection): Promise<PackageVersionDetails> {
    const queryString = `SELECT SubscriberPackageVersionId,SubscriberPackageVersion.MajorVersion,SubscriberPackageVersion.MinorVersion,SubscriberPackageVersion.PatchVersion FROM InstalledSubscriberPackage WHERE SubscriberPackageId = '${packageId}' LIMIT 1`;
    const queryResult = await targetOrgCon.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      return { id: undefined };
    }
    const record = queryResult.records[0] as Package2Version;
    return {
      id: record.SubscriberPackageVersionId,
      versionName: this.mergeVersionName(record.SubscriberPackageVersion!),
    };
  }

  private mergeVersionName(subscriberPackage: SubscriberPackageVersionType): string {
    return `${subscriberPackage.MajorVersion}.${subscriberPackage.MinorVersion}.${subscriberPackage.PatchVersion}`;
  }
}

type Package2Version = {
  SubscriberPackageVersionId?: string;
  SubscriberPackageVersion?: SubscriberPackageVersionType;
};

type SubscriberPackageVersionType = {
  MajorVersion: string;
  MinorVersion: string;
  PatchVersion: string;
};

type PackageVersionDetails = {
  id?: string;
  versionName?: string;
};
