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
  components: PackageGarbage[] | UnknownPackageGarbage[];
};

export type PackageGarbageResult = {
  deprecatedMembers: { [x: string]: PackageGarbageContainer };
  unsupportedTypes: { [x: string]: PackageGarbageContainer };
  notImplementedTypes: UnknownEntityPrefix[];
};

type UnknownEntityPrefix = {
  keyPrefix: string;
  entityName: string;
  memberCount: number;
};
