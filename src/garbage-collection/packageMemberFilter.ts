import { EntityDefinition, Package2, Package2Member } from '../types/sfToolingApiTypes.js';

export default class PackageMemberFilter {
  private readonly allowedSubscriberPackages?: string[];
  private readonly allowedKeyPrefixes?: string[];

  public constructor(packages: Package2[], entities: EntityDefinition[]) {
    if (packages && packages.length > 0) {
      this.allowedSubscriberPackages = packages.map((pgk) => pgk.SubscriberPackageId);
    }
    if (entities && entities.length > 0) {
      this.allowedKeyPrefixes = entities.map((entity) => entity.KeyPrefix);
    }
  }

  public isAllowed(member: Package2Member): boolean {
    return this.isAllowedSubscriberPackage(member) && this.isAllowedKeyPrefix(member);
  }

  private isAllowedKeyPrefix(member: Package2Member): boolean {
    if (!this.allowedKeyPrefixes || this.allowedKeyPrefixes.length === 0) {
      return true;
    }
    return this.allowedKeyPrefixes.includes(member.SubjectKeyPrefix.toLowerCase());
  }

  private isAllowedSubscriberPackage(member: Package2Member): boolean {
    if (!this.allowedSubscriberPackages || this.allowedSubscriberPackages.length === 0) {
      return true;
    }
    return this.allowedSubscriberPackages.includes(member.SubscriberPackageId);
  }
}
