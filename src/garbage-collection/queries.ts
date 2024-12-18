import QueryBuilder from '../common/utils/queryBuilder.js';

export const PACKAGE_MEMBER_QUERY = QueryBuilder.sanitise(`SELECT
  Id,
  CurrentPackageVersionId,
  MaxPackageVersionId,
  SubjectId,
  SubjectKeyPrefix,
  SubjectManageableState
FROM
  Package2Member
WHERE
  SubjectManageableState IN ('deprecatedEditable', 'deprecated')
ORDER BY
  SubjectKeyPrefix`);

export const ENTITY_DEFINITION_QUERY = QueryBuilder.sanitise(`SELECT
  Id,
  DurableId,
  QualifiedApiName,
  DeveloperName,
  MasterLabel,
  KeyPrefix,
  IsRetrieveable
FROM
  EntityDefinition`);

export const OBSOLETE_FLOWS: string = QueryBuilder.sanitise(`SELECT
  Id,
  VersionNumber,
  Definition.DeveloperName,
  Status
FROM
  Flow
WHERE
  Status = 'Obsolete'
ORDER BY
  Definition.DeveloperName,
  VersionNumber ASC`);

export const ALL_CUSTOM_OBJECTS: string = QueryBuilder.sanitise(`SELECT
  Id,
  DurableId,
  QualifiedApiName,
  DeveloperName,
  MasterLabel,
  KeyPrefix,
  IsRetrieveable
FROM
  EntityDefinition
WHERE
  KeyPrefix LIKE 'a%'
  OR KeyPrefix LIKE 'm%'
  OR KeyPrefix LIKE 'e%'`);
