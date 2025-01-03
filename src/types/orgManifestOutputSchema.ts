import { z } from 'zod';
import { DeployStatus, DeployStrategies } from './orgManifestGlobalConstants.js';

/** JSON output schema - all camelCase */

const ArtifactDeployResult = z.object({
  deployStrategy: z.string(),
  status: DeployStatus,
  targetUsername: z.string().optional(),
  displayMessage: z.string().optional(),
  errorDetails: z.unknown(),
});

const AggregatedArtifactResult = z.object({
  status: DeployStatus,
  message: z.string().optional(),
});

const ManifestDeployResult = z.record(z.string(), z.array(ArtifactDeployResult));

const SourceDeployResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.SourceDeploy),
  sourcePath: z.string().optional(),
});

const PackageInstallResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.PackageInstall),
  shouldSkipIfInstalled: z.boolean(),
  requestedVersion: z.string(),
  requestedVersionId: z.string(),
  installedVersion: z.string().optional(),
  installedVersionId: z.string().optional(),
  useInstallationKey: z.boolean(),
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
export type ZAggregatedArtifactResult = z.infer<typeof AggregatedArtifactResult>;
