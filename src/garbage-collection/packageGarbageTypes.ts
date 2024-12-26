export type PackageGarbage = {
  subjectId: string;
  developerName: string;
  fullyQualifiedName: string;
};

export type UnknownPackageGarbage = {
  subjectId: string;
};

export type PackageGarbageContainer = {
  metadataType: string;
  componentCount: number;
  components: PackageGarbage[];
};

export type IgnoredPackageGarbageContainer = {
  reason: string;
  metadataType: string;
  componentCount: number;
};

export type PackageGarbageResult = {
  deprecatedMembers: { [x: string]: PackageGarbageContainer };
  ignoredTypes: { [x: string]: IgnoredPackageGarbageContainer };
  notImplementedTypes: UnknownEntityPrefix[];
  totalDeprecatedComponentCount: number;
};

export type GarbageFilter = {
  includeOnly?: string[];
  packages?: string[];
};

type UnknownEntityPrefix = {
  keyPrefix: string;
  entityName: string;
  memberCount: number;
};
