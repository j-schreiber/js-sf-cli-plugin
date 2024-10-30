import { z } from 'zod';
import { DeployStatus, DeployStrategies } from './orgManifestGlobalConstants.js';

/** JSON output schema - all camelCase */

const ArtifactDeployResult = z.object({
  deployStrategy: z.string(),
  status: DeployStatus,
});

const ManifestDeployResult = z.record(z.string(), z.array(ArtifactDeployResult));

const SourceDeployResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.SourceDeploy),
  sourcePath: z.string().optional(),
});

const PackageInstallResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.PackageInstall),
  version: z.string(),
  shouldSkipIfInstalled: z.boolean(),
  versionId: z.string().optional(),
  installedVersion: z.string().optional(),
  installedVersionId: z.string().optional(),
  skipped: z.boolean().optional(),
  useInstallationKey: z.boolean().optional(),
  installationKey: z.string().optional(),
});

const CronJobScheduleResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.CronJobSchedule),
  jobName: z.string(),
});

const ZArtifactDeployResult = z.discriminatedUnion('deployStrategy', [
  SourceDeployResult,
  PackageInstallResult,
  CronJobScheduleResult,
]);

export type ZManifestDeployResultType = z.infer<typeof ManifestDeployResult>;
export type ZArtifactDeployResultType = z.infer<typeof ZArtifactDeployResult>;
export type ZSourceDeployResultType = z.infer<typeof SourceDeployResult>;
export type ZPackageInstallResultType = z.infer<typeof PackageInstallResult>;
