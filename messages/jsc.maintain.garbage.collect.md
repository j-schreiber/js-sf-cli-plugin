# summary

Identify and export garbage from package installs.

# description

Identifies left-overs from package upgrades that remain on the target org. They usually happen when installing package versions that remove components.
This commands analyses deprecated components on the target org and exports them for retrieval or removal.

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
