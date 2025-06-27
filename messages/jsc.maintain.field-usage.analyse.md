# summary

Analyse the utilisation of fields for one or more sobjects.

# description

Retrieves the total number of records for an sobject, then each filterable field is analysed
for how many records have a "non nullish" value. The following field types are supported:
%s.

# flags.sobject.summary

The name of an sobject to analyse.

# flags.sobject.description

Specify this flag multiple times to analyse multiple sobjects with a single command execution.
Use the full API name of the object.

# flags.target-org.summary

Username or alias of the target org, where analysis is run.

# flags.custom-fields-only.summary

Only analyse custom fields.

# flags.custom-fields-only.description

If omitted, the command analyses standard fields and custom fields of an object.

# flags.exclude-formulas.summary

Only analyse non-formula fields.

# flags.exclude-formulas.description

If omitted, the command analyses all field types, regardless if it is a calculated fields or not.
If a field is calculated (a formula field), the type shows "formula (return value)".

# examples

- Analyse all fields for Account and MyCustomObject__c object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account -s MyCustomObject__c

- Analyse only custom fields for Account object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account --custom-fields-only

- Analyse all fields, but exclude formulas for Order object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Order --exclude-formulas
