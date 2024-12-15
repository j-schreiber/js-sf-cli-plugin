SELECT
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
  OR KeyPrefix LIKE 'e%'