# flags.output-format.summary

Specify in which manifest file the content is written.

# flags.output-format.description

The default option prepares a package.xml with all flow versions. If you specify DestructiveChangesXML, the command creates an empty package.xml and writes all components into destructiveChanges.xml. This flag only has an effect, if the output directory is set. No source is retrieved or deployed.

# flags.output-dir.summary

Path where package manifests will be created.

# flags.output-dir.description

When provided, the command creates a manifest file (package.xml) at the target location with all exported content. Use the --output-format flag to write contents to destructiveChanges.xml.
