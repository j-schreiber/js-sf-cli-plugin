export type ManifestRolloutResult = {
  targetOrgUsername?: string;
  devhubOrgUsername?: string;
  deployedArtifacts: ArtifactDeployResult[];
};

export type ArtifactDeployResult = {
  name: string;
  deployStrategy?: string;
  deployResult?: string;
  version?: string;
  versionId?: string;
  installedVersion?: string;
  installedVersionId?: string;
  sourcePath?: string;
};
