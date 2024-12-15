export type PackageGarbage = {
  subjectId: string;
  developerName: string;
  fullyQualifiedName: string;
};

export type UnknownPackageGarbage = {
  subjectId: string;
};

export type PackageGarbageContainer = {
  components: PackageGarbage[] | UnknownPackageGarbage[];
  metadataType: string;
};

export type PackageGarbageResult = {
  deprecatedMembers: { [x: string]: PackageGarbageContainer };
  unsupportedTypes: { [x: string]: PackageGarbageContainer };
  unknownTypes: UnknownEntityPrefix[];
};

type UnknownEntityPrefix = {
  keyPrefix: string;
  entityName: string;
  memberCount: number;
};
