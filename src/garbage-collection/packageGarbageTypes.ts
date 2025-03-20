export type PackageGarbage = {
  subjectId: string;
  developerName: string;
  /**
   * Fully resolved name, including parent object (e.g. on custom fields, workflows, etc)
   */
  fullyQualifiedName: string;
  /**
   * Package version that deprecated the component (the first version to NOT contain it)
   */
  deprecatedSinceVersion?: string;
  packageName?: string;
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

export type UnknownEntityPrefix = {
  keyPrefix: string;
  entityName: string;
  memberCount: number;
};
