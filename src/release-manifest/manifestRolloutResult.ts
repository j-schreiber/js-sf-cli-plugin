export type ManifestRolloutResult = {
  targetOrgUsername?: string;
  devhubOrgUsername?: string;
  deployedArtifacts: ArtifactDeployResult[];
};

export type ArtifactDeployResult = {
  deployStrategy: string;
  status: string;
};

export type SourceDeployResult = ArtifactDeployResult & {
  sourcePath: string;
};

export type PackageInstallResult = ArtifactDeployResult & {
  version: string;
  versionId: string;
  installedVersion: string;
  installedVersionId: string;
};
