SELECT
  Id,
  MaxPackageVersion.Name,
  SubscriberPackage.Name,
  SubjectId,
  SubjectKeyPrefix
FROM
  Package2Member
WHERE
  MaxPackageVersionId != NULL
ORDER BY
  SubjectKeyPrefix