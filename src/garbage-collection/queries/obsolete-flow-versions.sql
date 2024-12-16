SELECT
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
  VersionNumber ASC