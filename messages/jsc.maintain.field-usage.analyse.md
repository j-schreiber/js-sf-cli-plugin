# summary

Analyse the utilisation of custom and standard fields for one or more sobjects.

# description

The analysis retrieves the total number of records for an sobject, then each filterable
field is compared for how many records have a "non nullish" value. Not all fields can be
analysed. You can find more information of analysable data types in the type column
of output table.

# flags.sobject.summary

Provide one more sobjects to analyse.

# flags.sobject.description

Specify this flag multiple times to analyse multiple sobjects at the same time. Use the full API name of the object.

# flags.target-org.summary

Username or alias of the target org to analyse.

# flags.custom-fields-only.summary

Only to only analyse custom fields.

# flags.custom-fields-only.description

If omitted, the engine analyses both standard fields and custom fields of each object.

# examples

- Analyse all fields for Account and MyCustomObject\_\_c object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account -s MyCustomObject\_\_c

- Analyse only custom fields for Account object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account --custom-fields-only
