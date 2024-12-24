# summary

Collect garbage on your org and export to json or package.xml for more actions.

# description

Identifies left-overs from package upgrades. This includes deprecated components (custom fields, objects, layouts, etc that were removed from package content, but not deleted on target org after install), outdated flow versions, empty test suites, etc.

# flags.target-org.summary

Target org to analyse.

# flags.target-org.description

All deprecated package members from this org are analysed.

# flags.devhub-org.summary

Used to resolve package ids when garbage must be filtered by package (--package)

# flags.devhub-org.description

Package filters are set with the "0Ho"-Id of the Package2 container. The DevHub is needed to resolve these ids to the canonical "033" Ids. If your target org is a devhub, it will automatically be used. This parameter is only needed, if you specify at least one package flag.

# flags.output-dir.summary

Optionally provide the path of the manifest to create.

# flags.output-dir.description

When provided, the command creates a manifest file (`package.xml`) at the target location.

# flags.metadata-type.summary

Only include certain metadata types in the result.

# flags.metadata-type.description

Only provided metadata types are processed and added to "deprecated components" result. All other will be ignored. You can specify this flag multiple times. Use the developer name of the entity definition (e.g. ExternalString instead of CustomLabel). All values are case insensitive.

# flags.package.summary

Only include metadata from a specific package.

# flags.package.description

You can specify the package id (0Ho) or a local package alias from your sfdx-project.json to narrow down package members only from a specific package. You can specify this flag multiple times.

# examples

- <%= config.bin %> <%= command.id %> -o Production --json
- <%= config.bin %> <%= command.id %> -o Production -d my-package-dir
- <%= config.bin %> <%= command.id %> -o Production -m ExternalString -m CustomObject
