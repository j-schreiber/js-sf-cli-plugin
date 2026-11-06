# summary

Collect garbage on your org and export to json or package.xml for more actions.

# description

Identifies left-overs from package upgrades. This includes deprecated components (custom fields, objects, layouts, etc that were removed from package content, but not deleted on target org after install), outdated flow versions, empty test suites, etc. The structured JSON output gives you insight into the metadata types still on the org and how they can be processed. You can optionally generate a package.xml or destructiveChanges.xml for further processing.

# flags.target-org.summary

Target org to analyse.

# flags.target-org.description

The org that is queried for deprecated package members and outdated flow versions.

# flags.devhub-org.summary

Used to resolve package ids (0Ho) and aliases when garbage is filtered by package (--package).

# flags.devhub-org.description

Package filters with package ids (0Ho) or aliases need the DevHub to resolve the package id to the subscriber package id (033), which package members reference. If your target org is a devhub, it will automatically be used. Package names, namespaces and subscriber package ids (033) don't need a DevHub.

# flags.metadata-type.summary

Only include specific metadata types in the result.

# flags.metadata-type.description

Only provided metadata types are processed and added to "deprecated components" result. All other will be ignored. You can specify this flag multiple times. Use the developer name of the entity definition (e.g. ExternalString instead of CustomLabel). Values are case insensitive.

# flags.package.summary

Only include metadata from specific packages.

# flags.package.description

Narrow down package members to specific packages. Use the name or namespace of an installed package, or its subscriber package id (033): these work without a DevHub and outside of a project. You can also use the package id (0Ho, requires a DevHub) or a package alias from your sfdx-project.json (requires a project and a DevHub). Names and namespaces are case-insensitive. You can specify this flag multiple times. If none of the packages can be resolved, the command fails.

# examples

- <%= config.bin %> <%= command.id %> -o Production --json
- <%= config.bin %> <%= command.id %> -o Production -d my-package-dir
- <%= config.bin %> <%= command.id %> -o Production -m ExternalString -m CustomObject
- <%= config.bin %> <%= command.id %> -o Production -m ExternalString -p SalesCRM -d tmp/test-run
