export type Package2Version = {
  SubscriberPackageVersionId: string;
  SubscriberPackageVersion: SubscriberPackageVersion;
  IsReleased: boolean;
};

/** The one with id 04t */
export type SubscriberPackageVersion = {
  MajorVersion: string;
  MinorVersion: string;
  PatchVersion: string;
  IsBeta: boolean;
  IsPasswordProtected: boolean;
};

export type InstalledSubscriberPackage = {
  SubscriberPackageId: string;
  SubscriberPackageVersionId: string;
  SubscriberPackageVersion: SubscriberPackageVersion;
};
