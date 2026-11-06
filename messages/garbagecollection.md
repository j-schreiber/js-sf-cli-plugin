# infos.excluded-from-result-not-in-filter

Excluded from result because metadata type filter was active and this type was not filtered.

# infos.not-fully-supported-by-tooling-api

Entity %s (%s) is not fully supported by Tooling API: %s. %s members are ignored.

# infos.not-yet-implemented

Entity %s (%s) is not yet implemented. %s members are ignored.

# infos.unknown-keyprefix

Failed to resolve keyprefix %s to a valid entity definition. %s members are ignored.

# infos.not-a-sfdx-project

Could not initialise project (%s).

# infos.unknown-error-initialising-project

Failed to initialise project with an unknown error.

# infos.package-aliases-not-supported

To use package aliases, run this command within a valid project. You can still use package ids (0Ho), subscriber package ids (033), package names or namespaces.

# infos.packages-filter-active

Packages filter active. Only include members from these packages: %s

# infos.metadata-filter-active

Metadata types filter active. Only include members of these types: %s

# infos.resolved-package-id

Resolved %s (Package2) to %s (SubscriberPackage)

# warnings.failed-to-resolved-package-id

Could not resolve %s (Package2) to its corresponding SubscriberPackageId (033). The Id does not exist on DevHub (%s). Id will be ignored for filtering package members. Did you use the correct DevHub?

# packages-filter-no-devhub

Packages filter contains package ids (0Ho), but no Devhub was provided.

# provide-valid-devhub-with-filter

Provide a valid DevHub to resolve package ids (0Ho). Alternatively, filter by package name, namespace or subscriber package id (033), which don't need a DevHub.

# infos.resolved-package-name

Resolved %s to installed package %s (SubscriberPackage)

# warnings.failed-to-resolve-package-name

Could not resolve %s to an installed package on %s. Use the name or namespace of an installed package. It will be ignored for filtering package members.

# errors.no-package-resolved

None of the packages in the filter could be resolved: %s. Use package ids (0Ho, requires a DevHub), subscriber package ids (033), aliases from sfdx-project.json, or the name or namespace of an installed package.

# record-types-cannot-be-deleted

Record types cannot be deleted via metadata API.

# deprecated-list-views-not-accessible

List views are not accessible via APIs, when member is deprecated.
