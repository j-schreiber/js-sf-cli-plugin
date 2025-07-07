# flags.output-format.summary

Specify in which manifest file the content is written.

# flags.output-format.description

The default option prepares a package.xml with all exported components. If you specify DestructiveChangesXML, the command creates an empty package.xml and writes all components into destructiveChanges.xml. This flag only has an effect, if the output directory is set. No source is retrieved or deployed.

# flags.output-dir.summary

Path where package manifests will be created.

# flags.output-dir.description

When provided, creates manifest file (package.xml) at the target location with all exported content. Use the --output-format flag to write contents to destructiveChanges.xml.

# flags.concise.summary

Summarize flow output table.

# flags.concise.description

Instead of showing individual exported flow versions, show aggregated information with the flow name and the total number of versions. Only modifies the formatted output table, not the JSON output or generated package manifests.

# flags.result-format.summary

Change the display formatting of output tables.

# flags.result-format.description

Changes output format of table results that are printed to stdout. Use a format that is easier to copy-paste or export into other programs that support the format. For example, use markdown to copy-paste table outputs to Obsidian or Confluence.
