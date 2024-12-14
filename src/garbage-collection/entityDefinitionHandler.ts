import QueryBuilder from '../common/utils/queryBuilder.js';
import { Package2Member } from '../types/sfToolingApiTypes.js';
import { PackageGarbage } from './packageGarbage.js';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface EntityDefinitionHandler {
  resolve(packageMembers: Package2Member[]): Promise<PackageGarbage[]>;
}

export function buildSubjectIdFilter(packageMembers: Package2Member[]): string {
  const subjectIds: string[] = [];
  packageMembers.forEach((member) => {
    subjectIds.push(member.SubjectId);
  });
  return QueryBuilder.buildParamListFilter('Id', subjectIds);
}
