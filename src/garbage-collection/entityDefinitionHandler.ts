/* eslint-disable @typescript-eslint/consistent-type-definitions */
import QueryBuilder from '../common/utils/queryBuilder.js';
import { Package2Member } from '../types/sfToolingApiTypes.js';
import { IgnoredPackageGarbageContainer, PackageGarbage, PackageGarbageContainer } from './packageGarbageTypes.js';

export interface EntityDefinitionHandler {
  resolve(packageMembers: Package2Member[]): Promise<PackageGarbageContainer>;
}

export interface EntityDefinitionIgnorer {
  resolve(packageMembers: Package2Member[]): Promise<IgnoredPackageGarbageContainer>;
}

export function resolvePackageDetails(member: Package2Member): Partial<PackageGarbage> {
  const deprecatedSinceVersion = member.MaxPackageVersion
    ? `${member.MaxPackageVersion.MajorVersion}.${member.MaxPackageVersion.MinorVersion}.${member.MaxPackageVersion.PatchVersion}`
    : undefined;
  return { deprecatedSinceVersion, packageName: member.SubscriberPackageId };
}

export function buildSubjectIdFilter(packageMembers: Package2Member[]): string {
  return QueryBuilder.buildParamListFilter('Id', extractSubjectIds(packageMembers));
}

export function extractSubjectIds(packageMembers: Package2Member[]): string[] {
  const subjectIds: string[] = [];
  packageMembers.forEach((member) => {
    subjectIds.push(member.SubjectId);
  });
  return subjectIds;
}
