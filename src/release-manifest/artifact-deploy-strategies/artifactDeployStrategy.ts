import { Connection } from '@salesforce/core';
import { ZArtifactDeployResultType } from '../../types/orgManifestOutputSchema.js';

export type ArtifactDeployStrategy = {
  /**
   * Return the internal state of the job, for inspection
   */
  getStatus(): Partial<ZArtifactDeployResultType>;

  /**
   * Returns the sf default command that is used to deploy the artifact
   */
  getCommandConfig(): SfCommandConfig;

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
  displayMessage?: string;
};
