# summary

Delete deprecated package components (garbage) from your org.

# description

Collects the same garbage as "jsc maintain garbage collect" and deletes it from the target org with a destructive deploy. Before anything is deleted, the command validates the deletion (check-only deploy). Components that cannot be deleted (e.g. an active approval process or an activated Lightning page) are removed from the deletion and reported with their reason, the rest is validated again. The command prints all garbage that was found and asks for confirmation before anything is validated or deleted. Afterwards, it prints all garbage that could not be deleted with the reason. Unsupported components (e.g. record types or list views) are never deleted. Garbage that could not be deleted is found again on the next run.

# flags.target-org.summary

Target org to purge garbage from.

# flags.target-org.description

The org that is queried for deprecated package members and outdated flow versions. All garbage that is found is deleted from this org.

# flags.devhub-org.summary

Used to resolve package ids when garbage must be filtered by package (--package).

# flags.devhub-org.description

Package filters are set with the "0Ho"-Id of the Package2 container. The DevHub is needed to resolve these ids to the canonical "033" Ids. If your target org is a devhub, it will automatically be used. This parameter is only needed, if you specify at least one package flag.

# flags.metadata-type.summary

Only delete specific metadata types.

# flags.metadata-type.description

Only provided metadata types are collected and deleted. All other will be ignored. You can specify this flag multiple times. Use the developer name of the entity definition (e.g. ExternalString instead of CustomLabel). Values are case insensitive.

# flags.package.summary

Only delete metadata from specific packages.

# flags.package.description

You can specify the package id (0Ho) or a local package alias from your sfdx-project.json to narrow down package members only from a specific package. You can specify this flag multiple times.

# flags.no-prompt.summary

Don't prompt before deleting components.

# flags.no-prompt.description

Without this flag, the command prints all garbage and asks for confirmation before deleting it. Use this flag in CI pipelines.

# confirmDisposal

Delete %s components from %s? This cannot be undone.

# infos.no-garbage-found

No garbage found. Nothing to delete.

# infos.aborted-by-user

Aborted by user. No components were deleted.

# titles.failed

Garbage that could not be deleted

# infos.disposing

Deleting garbage

# errors.disposal-failed

No garbage was deleted (%s components failed). See the table above for details.

# infos.validation-round

Round %s: validating %s components

# infos.deploy-started

Started destructive deploy %s.

# infos.quick-deploy-started

Started quick deploy %s of validation %s.

# infos.deploy-status

Deploy status: %s (%s/%s components).

# infos.disposal-succeeded

Deleted %s components.

# warnings.partial-success

%s components could not be deleted. Resolve the problems listed above and run the command again.

# examples

- Collect all garbage and delete it after confirmation

  <%= config.bin %> <%= command.id %> -o Production

- Delete deprecated custom labels and custom objects without prompt (CI)

  <%= config.bin %> <%= command.id %> -o Production -m ExternalString -m CustomObject --no-prompt

- Only delete garbage from a specific package (alias from sfdx-project.json)

  <%= config.bin %> <%= command.id %> -o Production -p SalesCRM -v MyDevHub
