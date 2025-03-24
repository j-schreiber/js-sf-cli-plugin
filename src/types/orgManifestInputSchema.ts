/* eslint-disable camelcase */

import { z } from 'zod';
import { ArtifactTypes } from './orgManifestGlobalConstants.js';
import { ScheduledJobConfig } from './scheduledApexTypes.js';

/** All schema are YAML input - therefore snake_case */

const ZEnvironments = z.record(z.string());

const ZUnlockedPackage = z.object({
  type: z.literal(ArtifactTypes.Enum.UnlockedPackage),
  package_id: z.string(),
  installation_key: z.string().optional(),
  skip_if_installed: z.boolean().optional(),
  version: z.string().regex(/^(\d+\.\d+\.\d+)$/, { message: 'Set version as MAJOR.MINOR.PATH (e.g. 1.4.0)' }),
});

const ZUnpackagedSource = z.object({
  type: z.literal(ArtifactTypes.Enum.Unpackaged),
  path: z.string().or(z.record(z.string())),
});

const ZCronJob = ScheduledJobConfig.extend({
  type: z.literal(ArtifactTypes.Enum.CronJob),
});

const ZManifestOptions = z
  .object({
    skip_if_installed: z.boolean().default(true),
    requires_promoted_versions: z.boolean().default(true),
    strict_environments: z.boolean().default(false),
    pipefail: z.boolean().default(true),
  })
  .default({});

const ZArtifact = z.discriminatedUnion('type', [ZUnlockedPackage, ZUnpackagedSource, ZCronJob]);

export const ZReleaseManifest = z
  .object({
    environments: ZEnvironments.optional(),
    artifacts: z.record(ZArtifact, { required_error: 'At least one artifact is required' }),
    options: ZManifestOptions,
  })
  .strict();

export type ZManifestEnvsType = z.infer<typeof ZEnvironments>;
export type ZManifestOptionsType = z.infer<typeof ZManifestOptions>;
export type ZReleaseManifestType = z.infer<typeof ZReleaseManifest>;
export type ZArtifactType = z.infer<typeof ZArtifact>;
export type ZUnlockedPackageArtifact = z.infer<typeof ZUnlockedPackage>;
export type ZUnpackagedSourceArtifact = z.infer<typeof ZUnpackagedSource>;
