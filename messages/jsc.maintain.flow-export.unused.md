# summary

Exports unpackaged unused flows from a target org.

# description

Finds versions from completely inactive flows that are not part of a package. The export contains all versions of the inactive flow. This is a complimentary command to the garbage collector, which exclusively analyses packaged flows.

# flags.target-org.summary

Target org to analyse.

# examples

- Analyse MyTargetOrg and export all unused flow versions to destructiveChanges.xml in tmp.

  <%= config.bin %> <%= command.id %> -o MyTargetOrg --output-dir tmp --output-format DestructiveChangesXML

- Analyse MyTargetOrg and print a table with all unused flow versions

  <%= config.bin %> <%= command.id %> -o MyTargetOrg
