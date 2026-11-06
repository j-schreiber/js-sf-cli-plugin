import { EntityDefinition, Package2Member } from '../types/sfToolingApiTypes.js';

export default class PackageMemberFilter {
  private readonly allowedSubscriberPackages?: string[];
  private readonly allowedKeyPrefixes?: string[];

  /**
   * @param subscriberPackageIds Allowed subscriber packages (033). Empty: all packages are allowed.
   * @param entities Allowed entity definitions. Empty: all entities are allowed.
   */
  public constructor(subscriberPackageIds: string[], entities: EntityDefinition[]) {
    if (subscriberPackageIds.length > 0) {
      this.allowedSubscriberPackages = subscriberPackageIds;
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
    return this.allowedKeyPrefixes.includes(member.SubjectKeyPrefix);
  }

  private isAllowedSubscriberPackage(member: Package2Member): boolean {
    if (!this.allowedSubscriberPackages || this.allowedSubscriberPackages.length === 0) {
      return true;
    }
    return this.allowedSubscriberPackages.includes(member.SubscriberPackageId);
  }
}
