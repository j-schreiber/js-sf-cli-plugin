import { Package2Member } from '../types/sfToolingApiTypes.js';

export class PackageGarbage {
  /**
   * Local id of the metadata entity. Prefix equals "keyPrefix".
   */
  public subjectId: string;
  /**
   * Regular developer name without additional parent context
   */
  public developerName: string;
  /**
   * Fully resolved name, including parent object (e.g. on custom fields, workflows, etc)
   */
  public fullyQualifiedName: string;
  /**
   * Package version that deprecated the component (the first version to NOT contain it).
   * May be empty, if the component is obsolete for other reasons.
   */
  public deprecatedSinceVersion?: string;
  /**
   * Name of the package that contains the component.
   */
  public packageName?: string;
  /**
   * Globally unique subscriber package id (can be used to identify `Package2Id`)
   */
  public subscriberPackageId: string;

  public constructor(packageMember: Package2Member, developerName: string, fullyQualifiedName?: string) {
    this.deprecatedSinceVersion = packageMember.MaxPackageVersion
      ? `${packageMember.MaxPackageVersion.MajorVersion}.${packageMember.MaxPackageVersion.MinorVersion}.${packageMember.MaxPackageVersion.PatchVersion}`
      : undefined;
    this.packageName = packageMember.SubscriberPackage?.Name;
    this.subscriberPackageId = packageMember.SubscriberPackageId;
    this.subjectId = packageMember.SubjectId;
    this.developerName = developerName;
    this.fullyQualifiedName = fullyQualifiedName ?? developerName;
  }
}

export type UnknownPackageGarbage = {
  subjectId: string;
};

export type PackageGarbageContainer = {
  metadataType: string;
  componentCount: number;
  components: PackageGarbage[];
};

export type UnsupportedGarbageContainer = {
  keyPrefix: string;
  entityName?: string;
  componentCount: number;
  reason: string;
};

export type PackageGarbageResult = {
  deprecatedMembers: { [x: string]: PackageGarbageContainer };
  unsupported: UnsupportedGarbageContainer[];
  totalDeprecatedComponentCount: number;
};

export type GarbageFilter = {
  includeOnly?: string[];
  packages?: string[];
};
