/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { Connection } from '@salesforce/core';
import { ZArtifactType, ZReleaseManifestType } from '../types/releaseManifest.js';
import ValidationResult from '../common/validationResult.js';
import { ArtifactDeployResult } from './manifestRolloutResult.js';

export default class ReleaseManifest {
  public constructor(private data: ZReleaseManifestType, private devhubConn: Connection) {}

  /**
   * Validates the release manifest with the supplied devhub connection
   *
   * @returns
   */
  public validate(): ValidationResult {
    console.log(this.data);
    console.log(this.devhubConn);
    // package id exists and version resolves to a valid subscriber package version -> devhub
    // package version is promoted -> devhub (for now, defaults are true)
    // all paths for unpackaged source exist (need to resolve env-specific)
    const result = new ValidationResult();
    return result;
  }

  /**
   * Rolls out the manifest against the target org.
   *
   * @param targetOrgConn
   */
  public async rollout(targetOrgConn: Connection): Promise<ArtifactDeployResult[]> {
    const deployResults: ArtifactDeployResult[] = [];
    for (const [artifactName, artifact] of this.getArtifacts()) {
      // initialise ManifestArtifactStep? ArtifactsItem?
      // fully build, all queries and validation is done
      // then call standardised interface to complete
      // on error the entire plan fails and aborts
      const artDeployResult: ArtifactDeployResult = {
        name: artifactName,
      };
      if (artifact.type === 'Unpackaged') {
        artDeployResult.deployStrategy = 'SourceDeploy';
        artDeployResult.deployResult = 'Deployed';
        artDeployResult.sourcePath = this.resolveDeployPath(artifact.path, targetOrgConn);
      }
      if (artifact.type === 'UnlockedPackage') {
        artDeployResult.deployStrategy = 'PackageInstall';
        artDeployResult.version = artifact.version;
        artDeployResult.deployResult = 'Skipped';
        const resolvedVersionId = await this.resolvePackageVersionId(artifact.version, artifact.package_id);
        if (resolvedVersionId === undefined) {
          throw new Error(
            `Failed to resolve version ${artifact.version} for ${artifactName} (${
              artifact.package_id
            }) with devhub ${this.devhubConn.getUsername()}`
          );
        }
        artDeployResult.versionId = resolvedVersionId;
      }
      deployResults.push(artDeployResult);
    }
    return deployResults;
  }

  //      PRIVATE ZONE

  private getArtifacts(): Map<string, ZArtifactType> {
    return new Map(Object.entries(this.data.artifacts));
  }

  private async resolvePackageVersionId(packageVersionLiteral: string, packageId: string): Promise<string | undefined> {
    const versionArray = packageVersionLiteral.split('.');
    const queryString = `SELECT SubscriberPackageVersionId FROM Package2Version WHERE Package2Id = '${packageId}' AND MajorVersion = ${versionArray[0]} AND MinorVersion = ${versionArray[1]} AND PatchVersion = ${versionArray[2]} AND IsReleased = true LIMIT 1`;
    const queryResult = await this.devhubConn.tooling.query(queryString);
    if (queryResult.records.length === 0) {
      return undefined;
    }
    const record = queryResult.records[0] as Package2Version;
    return record.SubscriberPackageVersionId;
  }

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
  }
}
type Package2Version = {
  SubscriberPackageVersionId: string;
};
