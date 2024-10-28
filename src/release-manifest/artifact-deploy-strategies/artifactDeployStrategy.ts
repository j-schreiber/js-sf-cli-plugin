import { Connection } from '@salesforce/core';
import { ArtifactDeployResult } from '../manifestRolloutResult.js';

export type ArtifactDeployStrategy = {
  /**
   * Prepare internal state of the step before "deploy" is run.
   * Requires both orgs connections ?? -> need to check
   *
   * @param targetOrg
   * @param devhubOrg
   */
  resolve(targetOrg: Connection, devhubOrg: Connection): void;

  /**
   * Execute the prepared deployment against the target org.
   *
   * @param targetOrg
   */
  deploy(targetOrg: Connection): Promise<ArtifactDeployResult>;
};
