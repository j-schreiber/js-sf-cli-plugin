/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable class-methods-use-this */
import { Connection } from '@salesforce/core';
import { DeployStrategies, ZPackageInstallResultType, ZUnlockedPackageArtifact } from '../../types/releaseManifest.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnlockedPackageInstallStep implements ArtifactDeployStrategy {
  public internalState: ZPackageInstallResultType;

  public constructor(public artifact: ZUnlockedPackageArtifact) {
    this.internalState = {
      status: 'Pending',
      version: this.artifact.version,
      deployStrategy: DeployStrategies.Enum.PackageInstall,
    };
  }

  public async deploy(targetOrg: Connection): Promise<ZPackageInstallResultType> {
    this.internalState.status = 'Success';
    return this.internalState;
  }

  public async resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZPackageInstallResultType> {
    // verify package_id exists
    // version resolves to valid subscriber package version id
    this.internalState.versionId = await this.resolvePackageVersionId(
      this.artifact.version,
      this.artifact.package_id,
      devhubOrg
    );
    // package version requires installation key & is set
    // installation key (env var) is not empty
    console.log(`Resolving with: ${devhubOrg.getUsername()!}`);
    return this.internalState;
  }

  private async resolvePackageVersionId(
    packageVersionLiteral: string,
    packageId: string,
    devhubCon: Connection
  ): Promise<string | undefined> {
    const versionArray = packageVersionLiteral.split('.');
    const queryString = `SELECT SubscriberPackageVersionId FROM Package2Version WHERE Package2Id = '${packageId}' AND MajorVersion = ${versionArray[0]} AND MinorVersion = ${versionArray[1]} AND PatchVersion = ${versionArray[2]} AND IsReleased = true LIMIT 1`;
    const queryResult = await devhubCon.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      return undefined;
    }
    const record = queryResult.records[0] as Package2Version;
    return record.SubscriberPackageVersionId;
  }
}

type Package2Version = {
  SubscriberPackageVersionId: string;
};
