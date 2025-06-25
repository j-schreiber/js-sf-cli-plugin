# summary

Analyse the utilisation of fields for one or more sobjects.

# description

Retrieves the total number of records for an sobject, then each filterable field is analysed
for how many records have a "non nullish" value. Not all fields can be analysed: You can find
more information of analysable data types in the type column of output table.

# flags.sobject.summary

The name of an sobject to analyse.

# flags.sobject.description

Specify this flag multiple times to analyse multiple sobjects with a single command execution. Use the full API name of the object.

# flags.target-org.summary

Username or alias of the target org, where analysis is run.

# flags.custom-fields-only.summary

Specify this flag to only analyse custom fields.

# flags.custom-fields-only.description

If omitted, the command analyses both standard fields and custom fields of each object.

# examples

- Analyse all fields for Account and MyCustomObject\_\_c object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account -s MyCustomObject\_\_c

- Analyse only custom fields for Account object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account --custom-fields-only
