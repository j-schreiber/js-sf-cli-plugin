import QueryBuilder from '../common/utils/queryBuilder.js';

export const PACKAGE_MEMBER_BASE = `SELECT
  Id,
  CurrentPackageVersionId,
  MaxPackageVersionId,
  SubscriberPackageId,
  MaxPackageVersion.MajorVersion,
  MaxPackageVersion.MinorVersion,
  MaxPackageVersion.PatchVersion,
  SubjectId,
  SubjectKeyPrefix,
  SubjectManageableState
FROM
  Package2Member`;

// flow definitions (prefix 300) are processed separately
export const PACKAGE_MEMBER_QUERY = QueryBuilder.sanitise(`${PACKAGE_MEMBER_BASE} 
WHERE
  SubjectManageableState IN ('deprecatedEditable', 'deprecated')
  AND SubjectKeyPrefix NOT IN ('300')
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
  DefinitionId,
  Status
FROM
  Flow
WHERE
  Status = 'Obsolete'
ORDER BY
  Definition.DeveloperName,
  VersionNumber ASC
LIMIT 2000`);

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

export const PACKAGE_2: string = QueryBuilder.sanitise(`SELECT
  Id,
  SubscriberPackageId
FROM
  Package2`);
