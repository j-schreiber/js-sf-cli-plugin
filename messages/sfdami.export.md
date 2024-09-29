# summary

Export all data from a plan definition.

# description

Takes a plan definition and exports all data from the source org. The created files are
compatible with the "data import tree" command. Lookups are automatically resolved to
referenceIds to retain relationships. This command allows tree exports that are orders
of magnitute more complex than the basic "data export tree".

# flags.source-org.summary

The source org from where data is exported.

# flags.plan.summary

Path to the plan file that defines the export.

# flags.output-dir.summary

Output directory to export all fields.

# examples

- <%= config.bin %> <%= command.id %>
