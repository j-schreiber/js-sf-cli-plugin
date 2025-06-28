# summary

Exports unpackaged obsolete flows from a target org.

# description

Finds and exports inactive (Obsolete or Draft) versions of unpackaged flows. The active version is never included. This is a complimentary command to the garbage collector, which exclusively analyses packaged flows.

# flags.target-org.summary

Target org to analyse.

# examples

- Analyse MyTargetOrg and export all obsolete flow versions to destructiveChanges.xml in directory tmp/dev-obsolete.

  <%= config.bin %> <%= command.id %> -o MyTargetOrg --output-dir tmp/dev-obsolete --output-format DestructiveChangesXML

- Analyse MyTargetOrg and print a table with all obsolete flow versions

  <%= config.bin %> <%= command.id %> -o MyTargetOrg

# success.no-obsolete-versions-found

No obsolete flow versions found. You're all set.
