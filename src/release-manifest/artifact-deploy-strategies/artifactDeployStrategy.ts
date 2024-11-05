import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType } from '../../types/orgManifestOutputSchema.js';

export type ArtifactDeployStrategy = {
  /**
   * Return the internal state of the job, for inspection
   */
  getStatus(): Partial<ZArtifactDeployResultType>;

  /**
   * Deploys the artifact step with the current internal state.
   * Throws an exception, if called on a step that is not resolved.
   */
  deploy(): Promise<ZArtifactDeployResultType>;

  /**
   * Prepare internal state of the step before "deploy" is run.
   * Requires both orgs connections ?? -> need to check
   *
   * @param targetOrg
   * @param devhubOrg
   */
  resolve(targetOrg: Connection, devhubOrg: Connection): Promise<ZArtifactDeployResultType>;
};

export type SfCommandConfig = {
  args: string[];
  name?: string;
};
