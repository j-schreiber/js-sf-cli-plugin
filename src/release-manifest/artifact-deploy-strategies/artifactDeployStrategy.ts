import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType } from '../../types/releaseManifest.js';

export type ArtifactDeployStrategy = {
  internalState: ZArtifactDeployResultType;

  /**
   * Prepare internal state of the step before "deploy" is run.
   * Requires both orgs connections ?? -> need to check
   *
   * @param targetOrg
   * @param devhubOrg
   */
  resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZArtifactDeployResultType>;

  /**
   * Execute the prepared deployment against the target org.
   *
   * @param targetOrg
   */
  deploy(targetOrg: Connection): Promise<ZArtifactDeployResultType>;
};
