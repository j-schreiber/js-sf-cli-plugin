# summary

Collect garbage on your org and export to json or package.xml for more actions.

# description

Identifies left-overs from package upgrades. This includes deprecated components (custom fields, objects, layouts, etc that were removed from package content, but not deleted on target org after install), outdated flow versions, empty test suites, etc.

# flags.target-org.summary

Target org to analyse.

# flags.target-org.description

All deprecated package members from this org are analysed.

# flags.output-dir.summary

Optionally provide the path of the manifest to create.

# flags.output-dir.description

When provided, the command creates a manifest file (`package.xml`) at the target location.

# flags.metadata-type.summary

Only include certain metadata types in the result.

# flags.metadata-type.description

Only provided metadata types are processed and added to "deprecated components" result. All other will be ignored. You can specify this flag multiple times. Use the developer name of the entity definition (e.g. ExternalString instead of CustomLabel). All values are case insensitive.

# examples

- <%= config.bin %> <%= command.id %> -o Production --json
- <%= config.bin %> <%= command.id %> -o Production -d my-package-dir
- <%= config.bin %> <%= command.id %> -o Production -m ExternalString -m CustomObject
