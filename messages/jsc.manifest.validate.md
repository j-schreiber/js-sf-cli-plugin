# summary

Validate a manifest file. Same result as running "rollout" with "--validate-only".

# description

The manifest file is validated against a DevHub and Target Org. It tries to resolve package versions and deploy paths for all artifacts, but does not attempt to rollout the artifacts to the target org.

All artifacts are returned as RESOLVED, if validation succeeds.

# examples

- <%= config.bin %> <%= command.id %>
