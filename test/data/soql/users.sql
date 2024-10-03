SELECT
  Id,
  IsActive,
  FirstName,
  LastName,
  Username,
  Email,
  UserRole.Name,
  Profile.Name
FROM
  User
WHERE
  CompanyName = 'The Mobility House LLC'