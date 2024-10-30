import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType } from '../../types/orgManifestOutputSchema.js';

export type ArtifactDeployStrategy = {
  // internalState: ZArtifactDeployResultType;

  /**
   * Return the internal state of the job, for inspection
   */
  getStatus(): ZArtifactDeployResultType;

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
