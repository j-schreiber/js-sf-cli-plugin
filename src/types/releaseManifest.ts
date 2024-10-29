/* eslint-disable camelcase */

import { z } from 'zod';

export const DeployStrategies = z.enum(['SourceDeploy', 'PackageInstall', 'CronJobSchedule']);
export const ArtifactTypes = z.enum(['UnlockedPackage', 'Unpackaged', 'CronJob']);

const ZEnvironments = z.record(z.string());

const ZUnlockedPackage = z.object({
  type: z.literal(ArtifactTypes.Enum.UnlockedPackage),
  package_id: z.string(),
  installation_key: z.string().optional(),
  skip_if_installed: z.boolean().optional(),
  version: z.string().regex(/^([0-9]+\.[0-9]+\.[0-9]+)$/, { message: 'Set version as MAJOR.MINOR.PATH (e.g. 1.4.0)' }),
});

const ZUnpackagedSource = z.object({
  type: z.literal(ArtifactTypes.Enum.Unpackaged),
  path: z.string().or(z.record(z.string())),
});

const ManifestOptions = z.object({
  skip_if_installed: z.boolean().default(true),
  requires_promoted_versions: z.boolean().default(true),
  strict_environments: z.boolean().default(false),
  pipefail: z.boolean().default(true),
});

const ZArtifact = z.discriminatedUnion('type', [ZUnlockedPackage, ZUnpackagedSource]);

export const ZReleaseManifest = z
  .object({
    environments: ZEnvironments.optional(),
    artifacts: z.record(ZArtifact, { required_error: 'At least one artifact is required' }),
    options: ManifestOptions.optional(),
  })
  .strict();

const ArtifactDeployResult = z.object({
  deployStrategy: z.string(),
  status: z.enum(['Success', 'Pending', 'Failed']),
});

const SourceDeployResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.SourceDeploy),
  sourcePath: z.string().optional(),
});

const PackageInstallResult = ArtifactDeployResult.extend({
  deployStrategy: z.literal(DeployStrategies.Enum.PackageInstall),
  version: z.string(),
  versionId: z.string().optional(),
  installedVersion: z.string().optional(),
  installedVersionId: z.string().optional(),
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

export type ZArtifactDeployResultType = z.infer<typeof ZArtifactDeployResult>;
export type ZSourceDeployResultType = z.infer<typeof SourceDeployResult>;
export type ZPackageInstallResultType = z.infer<typeof PackageInstallResult>;

export type ZReleaseManifestType = z.infer<typeof ZReleaseManifest>;
export type ZArtifactType = z.infer<typeof ZArtifact>;
export type ZUnlockedPackageArtifact = z.infer<typeof ZUnlockedPackage>;
export type ZUnpackagedSourceArtifact = z.infer<typeof ZUnpackagedSource>;
