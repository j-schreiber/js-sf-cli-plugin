export type PackageGarbage = {
  developerName: string;
  metadataType: string;
  subjectId: string;
};

export type PackageGarbageContainer = {
  [x: string]: PackageGarbage[];
};
