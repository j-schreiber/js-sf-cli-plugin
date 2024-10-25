/* eslint-disable camelcase */

import { z } from 'zod';

const ZEnvironments = z.record(z.string());

const ZUnlockedPackage = z.object({
  type: z.literal('UnlockedPackage'),
  package_id: z.string(),
  installation_key: z.string().optional(),
  skip_if_installed: z.boolean().optional(),
  version: z.string(), // must be major.minor.patch
});

const ZUnpackagedSource = z.object({
  type: z.literal('Unpackaged'),
  path: z.string().or(z.record(z.string())),
});

const ManifestOptions = z.object({
  skip_if_installed: z.boolean().default(true),
  requires_promoted_versions: z.boolean().default(true),
  strict_environments: z.boolean().default(false),
});

const ZArtifact = z.discriminatedUnion('type', [ZUnlockedPackage, ZUnpackagedSource]);

export const ZReleaseManifest = z.object({
  environments: ZEnvironments.optional(),
  artifacts: z.record(ZArtifact),
  options: ManifestOptions.optional(),
});

export type ReleaseManifest = {
  packages: Packages;
  environments: Environments;
};

export type Environments = {
  [name: string]: string;
};

export type Packages = {
  [name: string]: PackageDefinition;
};

export type PackageDefinition = {
  type: string;
  package_id: string;
  version: string;
  skip_if_installed: boolean;
  overrides?: PackageDefinitionOverrides | string;
};

export type PackageDefinitionOverrides = {
  [name: string]: string;
};

export type ZReleaseManifestType = z.infer<typeof ZReleaseManifest>;
export type ZArtifactType = z.infer<typeof ZArtifact>;
