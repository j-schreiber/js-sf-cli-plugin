# summary

Exports unused flow from a target org.

# description

Finds flows that have no active version and that are not part of a package. This includes all existing versions in status "Inactive" (Obsolete) or Draft. The command analyses both "flow" and "process builder" versions.

# flags.target-org.summary

Target org to analyse.

# flags.output-dir.summary

Path to a directory where package manifests are created.

# flags.output-dir.description

When provided, the command creates a manifest file (package.xml) at the target location with all exported flow versions. Use the --output-format flag to write contents to destructiveChanges.xml.

# flags.output-format.summary

Write all contents to destructiveChanges.xml

# flags.output-format.description

The default option prepares a package.xml with all flow versions. If you specify DestructiveChangesXML, the command creates an empty package.xml and writes all components into destructiveChanges. This flag only has an effect, if the output directory is set. No source is retrieved or deployed.

# examples

- Analyse MyTargetOrg and export all unused flow versions to destructiveChanges.xml in tmp.

  <%= config.bin %> <%= command.id %> -o MyTargetOrg --output-dir tmp --output-format DestructiveChangesXML

- Analyse MyTargetOrg and print a table with all unused flow versions

  <%= config.bin %> <%= command.id %> -o MyTargetOrg
