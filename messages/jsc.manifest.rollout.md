# summary

Roll out a manifest. This deploys the artifacts of the manifest (unpackaged, package, etc) to the target org.

# description

The command takes an Org Manifest and rolls out its artifacts to a target org. Dynamic paths for unpackaged artifacts are resolved based on mapped environments, package versions are resolved based on the DevHub org.

# flags.manifest.summary

A manifest file that defines the desired state of the target org

# flags.target-org.summary

Target org (sandbox, production, etc) where artifacts of the manifest should be rolled out.

# flags.devhub-org.summary

Devhub that owns the packages. Needed to resolve package versions.

# flags.verbose.summary

Placeholder - Prints all subcommand outputs to terminal (e.g. deployed source files, package install status, etc)

# examples

- <%= config.bin %> <%= command.id %>

# errors.manifest-requires-project

Manifest has at least one step that requires a project, but no valid sfdx project was found in this directory.

# infos.target-org-info

Target org for rollout: %s

# infos.devhub-org-info

Devhub to resolve packages: %s
