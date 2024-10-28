/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable class-methods-use-this */
import { Connection } from '@salesforce/core';
import { ArtifactDeployResult } from '../manifestRolloutResult.js';
import ArtifactDeployJobStep from './artifactDeployJobStep.js';
import { ArtifactDeployStrategy } from './artifactDeployStrategy.js';

export default class UnlockedPackageInstallStep extends ArtifactDeployJobStep implements ArtifactDeployStrategy {
  public async deploy(targetOrg: Connection): Promise<ArtifactDeployResult> {
    const res: ArtifactDeployResult = {
      name: 'test',
    };
    return res;
  }

  public resolve(devhubOrg: Connection): void {
    // verify package_id exists
    // version resolves to valid subscriber package version id
    // package version requires installation key & is set
    // installation key (env var) is not empty
    console.log(`Resolving with: ${devhubOrg.getUsername()!}`);
  }
}
