# summary

(Re-)build an org index for a given plan file

# description

More detailed description

# flags.target-org.description

The target org (alias) - description

# flags.target-org.summary

The target org where data is exported to build index.

# flags.rebuild-cache.summary

Rebuilds the describe cache for all objects in the plan file.

# flags.plan.summary

The plan file to process.

# examples

- Build the index for a given plan file

  <%= config.bin %> <%= command.id %> --target-org YourImportTargetOrg --plan defs/my-plan-file.yaml

- Build the index and reset all cached sobject describes

  <%= config.bin %> <%= command.id %> --target-org YourImportTargetOrg --plan defs/my-plan-file.yaml --rebuild-cache
