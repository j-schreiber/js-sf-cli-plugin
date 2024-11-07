# summary

Summary of a command.

# description

More information about a command. Don't repeat the summary.

# flags.manifest.summary

Manifest file

# flags.target-org.summary

Target org (sandbox, production, etc) where manifest is deployed/rolled out

# flags.devhub-org.summary

Devhub that owns the packages

# flags.verbose.summary

Prints all subcommand outputs to terminal (e.g. deployed source files, package install status, etc).

# examples

- <%= config.bin %> <%= command.id %>

# errors.manifest-requires-project

Manifest has at least one step that requires a project, but no valid sfdx project was found in this directory.

# infos.target-org-info

Target org for rollout: %s

# infos.devhub-org-info

Devhub to resolve packages: %s
