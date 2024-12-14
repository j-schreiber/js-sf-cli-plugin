SELECT
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
  SubjectKeyPrefix