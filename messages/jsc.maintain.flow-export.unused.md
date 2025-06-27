# summary

Exports unused flows from a target org.

# description

Finds flows that have no active version and that are not part of a package. This includes all existing versions in status "Inactive" (Obsolete) or Draft. The command analyses both "flow" and "process builder" versions. This is a complimentary command to the garbage collector, which analyses only packaged flows.

# flags.target-org.summary

Target org to analyse.

# examples

- Analyse MyTargetOrg and export all unused flow versions to destructiveChanges.xml in tmp.

  <%= config.bin %> <%= command.id %> -o MyTargetOrg --output-dir tmp --output-format DestructiveChangesXML

- Analyse MyTargetOrg and print a table with all unused flow versions

  <%= config.bin %> <%= command.id %> -o MyTargetOrg
