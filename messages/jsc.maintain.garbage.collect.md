# summary

Collect garbage on your org and export to package.xml for more actions.

# description

Identifies left-overs from package upgrades. This includes deprecated components (custom fields, objects, layouts, etc that were removed from package content, but not deleted on target org after install), outdated flow versions, empty test suites, etc.

# flags.package.summary

Filter deprecated components by package.

# flags.package.description

Filter deprecated components by package. You can provide the package id (0Ho) or a local alias.

# flags.target-org.summary

Target org to analyse.

# flags.target-org.description

Target org to analyse. All deprecated package members from this org are analysed.

# examples

- <%= config.bin %> <%= command.id %>
