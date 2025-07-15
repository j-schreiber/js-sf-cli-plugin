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

# flags.verbose.summary

Display a table of fields that were ignored during analysis.

# flags.verbose.description

Depending on the flags that were used (--custom-fields-only, --exclude-formulas) and the existing fields on the sobject,
some fields are ignored during analysis. For more information on those fields, use this flag.

# flags.check-defaults.summary

Checks if values differ from defaults.

# flags.check-defaults.description

Performs an additional check for all fields that have a default value configured. If the field has a default value configered,
the analysis only counts a field as populated, if the value is different from the default. The analysis algorithm for fields 
without a default value does not change.

The default values of record types are not analysed.

# flags.check-history.summary

Run additional checks with field history (if enabled)

# flags.check-history.description

Analyses history tracking for this field and checks total number of changes and the date time of the last change. If history
tracking is not enabled for the SObject, this flag has no effect.

# flags.segment-record-types.summary

Segments the analysis by Record Types.

# flags.segment-record-types.description

Segmentation will run all checks per record type of the sobject. If the sobject does not have record types enabled, it will have
no effect. All records are returned as "Master". The analysis (output tables and JSON result) is grouped by record type developer name.
Segmentation significantly increases the number of API calls.

# examples

- Analyse all fields for Account and MyCustomObject__c object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account -s MyCustomObject__c

- Analyse only custom fields for Account object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Account --custom-fields-only

- Analyse all fields, but exclude formulas for Order object

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -s Order --exclude-formulas

# infos.check-defaults-enabled

Fields are only considered populated, if the value is different from configured default.

# infos.check-history-enabled

Retrieving additional infos about total number of field changes and last update timestamp.

# infos.segment-record-types-enabled

Results are organized by record types of the sobjects, defaults are evaluated per record type.