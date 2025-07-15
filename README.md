# @j-schreiber/sf-plugin

[![NPM](https://img.shields.io/npm/v/@j-schreiber/sf-plugin.svg?label=@j-schreiber/sf-plugin)](https://www.npmjs.com/package/@j-schreiber/sf-plugin) [![Downloads/week](https://img.shields.io/npm/dw/@j-schreiber/sf-plugin.svg)](https://npmjs.org/package/@j-schreiber/sf-plugin) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/@j-schreiber/sf-plugin/main/LICENSE.txt)

> This plugin is still in beta and under active development. Command signatures may be subject to change.

## Installation

The plugin is not digitally signed, so in order to avoid the prompt on installation, add it to your [`unsignedPluginAllowList.json`](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_allowlist.htm). If you don't mind the prompt, simply run:

```bash
sf plugins install @j-schreiber/sf-plugin
```

## Contribute

Contributers are welcome! Please reach out on [Linkedin](https://www.linkedin.com/in/jannis-schreiber/) or via [Email](mailto:info@lietzau-consulting.de).

## Documentation

Check out the [GitHub Wiki](https://github.com/j-schreiber/js-sf-cli-plugin/wiki) for in-depth documentation of concepts and technical limitations. Here's the exhaustive command reference.

<!-- commands -->

- [`sf jsc apex schedule export`](#sf-jsc-apex-schedule-export)
- [`sf jsc apex schedule manage`](#sf-jsc-apex-schedule-manage)
- [`sf jsc apex schedule start`](#sf-jsc-apex-schedule-start)
- [`sf jsc apex schedule stop`](#sf-jsc-apex-schedule-stop)
- [`sf jsc data export`](#sf-jsc-data-export)
- [`sf jsc maintain field-usage analyse`](#sf-jsc-maintain-field-usage-analyse)
- [`sf jsc maintain flow-export obsolete`](#sf-jsc-maintain-flow-export-obsolete)
- [`sf jsc maintain flow-export unused`](#sf-jsc-maintain-flow-export-unused)
- [`sf jsc maintain garbage collect`](#sf-jsc-maintain-garbage-collect)
- [`sf jsc manifest rollout`](#sf-jsc-manifest-rollout)
- [`sf jsc manifest validate`](#sf-jsc-manifest-validate)

## `sf jsc apex schedule export`

List all scheduled jobs on the target org.

```
USAGE
  $ sf jsc apex schedule export -o <value> [--json] [--flags-dir <value>] [-c <value>] [-j <value>] [-d <value>]
  [--concise]

FLAGS
  -c, --apex-class-name=<value>  Only list jobs from a specific apex class.
  -d, --output-dir=<value>       Writes exported jobs to a config file that can be used with "manage" command.
  -j, --job-name=<value>         Only list jobs with a specific job name. Supports partial matches.
  -o, --target-org=<value>       (required) Target org to check.
      --concise                  Minimize columns displayed in output table.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List all scheduled jobs on the target org.

  Export all jobs currently scheduled on the target org or specify additional filters to narrow down search results.

EXAMPLES
  List all jobs on the target org

    $ sf jsc apex schedule export -o MyTargetOrg

  List jobs that match apex class and job name

    $ sf jsc apex schedule export -o MyTargetOrg -c MyScheduledJobClass -n "Scheduled Job Name"

  List jobs that start with "Auto" and export them to tmp/dev/jobs.yaml

    $ sf jsc apex schedule export -j "Auto" -d tmp/dev
```

_See code: [src/commands/jsc/apex/schedule/export.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/apex/schedule/export.ts)_

## `sf jsc apex schedule manage`

Manages all cron jobs on a target org from config file.

```
USAGE
  $ sf jsc apex schedule manage -o <value> -f <value> [--json] [--flags-dir <value>] [--dry-run]

FLAGS
  -f, --config-file=<value>  (required) Path to a valid config file that configures scheduled jobs.
  -o, --target-org=<value>   (required) Target org where the job will be scheduled.
      --dry-run              Simulate a run and get information on how many jos would be started, stopped, and left
                             untouched.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Manages all cron jobs on a target org from config file.

  Provide the path to a config file that contains a definition of scheduled jobs. The manage command will try to start
  non-existing jobs and, depending on options, also stop obsolete running jobs. All options for this command are read
  from the config file.

EXAMPLES
  Sync all jobs on target org with config file

    $ sf jsc apex schedule manage -o MyTargetOrg -f scheduled-job-definitions.yaml

FLAG DESCRIPTIONS
  -f, --config-file=<value>  Path to a valid config file that configures scheduled jobs.

    Specify the jobs to start, together with options how obsolete or redundant jobs should be treated. Jobs are
    identified by their unique job name. You can specify the same apex class multiple times, as long as job names are
    different. For convenience, you can also use the apex class as job name and omit class property - in that case, you
    can only schedule an apex class once for obvious reasons.

  --dry-run  Simulate a run and get information on how many jos would be started, stopped, and left untouched.

    Queries existing jobs on the target org and evaluates, which jobs would be changed. However, dry-run cannot compile
    the apex class and cron expression. This means, that invalid cron expressions or apex classes will not be caught and
    the command may still fail, when run without this flag.
```

_See code: [src/commands/jsc/apex/schedule/manage.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/apex/schedule/manage.ts)_

## `sf jsc apex schedule start`

Schedule a cron job on the target org.

```
USAGE
  $ sf jsc apex schedule start -o <value> -c <value> -e <value> [--json] [--flags-dir <value>] [-n <value>] [--trace]

FLAGS
  -c, --apex-class-name=<value>  (required) Name of the Apex class to schedule.
  -e, --cron-expression=<value>  (required) The cron expression that specifies execution of the job.
  -n, --name=<value>             Unique name of the cron job.
  -o, --target-org=<value>       (required) Target org where the job will be scheduled.
      --trace                    Log detailed debug information of command execution.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Schedule a cron job on the target org.

  Provide the name of an apex class that implements the `Schedulable` interface and a cron expression to schedule a cron
  job (`CronTrigger`). Use the official Documentation to learn more about cron expressions:
  https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_scheduler.htm.

EXAMPLES
  Schedule a class to run every day at 1 am:

    $ sf jsc apex schedule start -c MyJobImplementationName -e '0 0 1 * * ?'

  Schedule a class to run on weekdays (Monday to Friday) at 10 am:

    $ sf jsc apex schedule start -c MyJobImplementationName -e '0 0 10 ? * MON-FRI'

  Schedule a job with a custom name to run every day at 5:30pm:

    $ sf jsc apex schedule start -c MyJobImplementationName -e "0 30 17 * * ?" -n "My Job Name"

FLAG DESCRIPTIONS
  -c, --apex-class-name=<value>  Name of the Apex class to schedule.

    Must implement the System.Schedulable interface.

  -e, --cron-expression=<value>  The cron expression that specifies execution of the job.

    Provide the expression in unix-compatible format (see Apex Documentation for more details). The basic syntax of the
    expression is "Seconds Minutes Hours Day_of_month Month Day_of_week Optional_year". See examples for commonly used
    cron expressions.

  -n, --name=<value>  Unique name of the cron job.

    If you leave this empty, the name of the apex class is used. Jobs must be unique by name: Use different names if you
    plan to schedule the same apex class multiple times.

  --trace  Log detailed debug information of command execution.

    Due to limitations of available Salesforce APIs, this command uses an anonymous apex execution under the hood. The
    execution may fail due to a variety of reasons, and the scheduler tries its best to extract the correct error
    messages. If this doesn't help, use the --trace flag to output full debug logs from the execution.
```

_See code: [src/commands/jsc/apex/schedule/start.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/apex/schedule/start.ts)_

## `sf jsc apex schedule stop`

Stop one or more cron jobs on the target org.

```
USAGE
  $ sf jsc apex schedule stop -o <value> [--json] [--flags-dir <value>] [-c <value>] [-i <value>...] [-n <value>] [--trace]
    [--no-prompt]

FLAGS
  -c, --apex-class-name=<value>  Name of an apex class to stop.
  -i, --id=<value>...            The CronTrigger Id of the job to stop.
  -n, --name=<value>             Identify the scheduled job by its provided name.
  -o, --target-org=<value>       (required) Target org where the job will stopped.
      --no-prompt                Don't prompt before performing destructive changes.
      --trace                    Log detailed debug information of command execution.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Stop one or more cron jobs on the target org.

  The command allows to stop one or more scheduled jobs, based on the provided inputs. You can provide the name of an
  apex class, the name of a scheduled job or a list of ids (08e). The command is idempotent: That means it succeeds,
  even if no job was actually stopped. If you provide multiple filters (e.g. an apex class and an id), all jobs that
  satisfy at least one of the criteria are stopped.

EXAMPLES
  Stop all scheduled jobs on a target org

    $ sf jsc apex schedule stop -o MyTargetOrg

  Stop a job by its id on your default org

    $ sf jsc apex schedule stop -i 08e9b00000KktvqAAB

  Stop all scheduled jobs of a particular apex class on a target org

    $ sf jsc apex schedule stop -c MyCaseReminderJob -o MyTargetOrg

FLAG DESCRIPTIONS
  -c, --apex-class-name=<value>  Name of an apex class to stop.

    The command finds all scheduled instances of this apex class and stops them.

  -i, --id=<value>...  The CronTrigger Id of the job to stop.

    Provide the Id of the cron trigger that was returned by `System.schedule`. If the Id is invalid, an error is
    returned. You can add this flag multiple times to specify multiple jobs.

  --no-prompt  Don't prompt before performing destructive changes.

    Without this flag, the command asks for confirmation before stopping them. Use this flag in CI pipelines.

  --trace  Log detailed debug information of command execution.

    Due to limitations of available Salesforce APIs, this command uses an anonymous apex execution under the hood. The
    execution may fail due to a variety of reasons, and the scheduler tries its best to extract the correct error
    messages. If this doesn't help, use the --trace flag to output full debug logs from the execution.
```

_See code: [src/commands/jsc/apex/schedule/stop.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/apex/schedule/stop.ts)_

## `sf jsc data export`

Export all data from a plan definition.

```
USAGE
  $ sf jsc data export -o <value> -p <value> [--json] [--flags-dir <value>] [-d <value>] [--validate-only]
    [--api-version <value>]

FLAGS
  -d, --output-dir=<value>   Output directory to export all fields.
  -o, --source-org=<value>   (required) The source org from where data is exported.
  -p, --plan=<value>         (required) Path to the plan file that defines the export.
      --api-version=<value>  Override the api version used for api requests made by this command
      --validate-only        Does not retrieve records. Only validates the plan.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Export all data from a plan definition.

  Takes a plan definition and exports all data from the source org. The created files are
  compatible with the "data import tree" command. Lookups are automatically resolved to
  referenceIds to retain relationships. This command allows tree exports that are orders
  of magnitute more complex than the basic "data export tree".

EXAMPLES
  $ sf jsc data export
```

_See code: [src/commands/jsc/data/export.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/data/export.ts)_

## `sf jsc maintain field-usage analyse`

Analyse the utilisation of fields for one or more sobjects.

```
USAGE
  $ sf jsc maintain field-usage analyse -s <value>... -o <value> [--json] [--flags-dir <value>] [--custom-fields-only]
    [--exclude-formulas] [--check-defaults] [--check-history] [--segment-record-types] [--verbose] [--api-version
    <value>] [-r human|csv|markdown]

FLAGS
  -o, --target-org=<value>      (required) Username or alias of the target org, where analysis is run.
  -r, --result-format=<option>  [default: human] Change the display formatting of output tables.
                                <options: human|csv|markdown>
  -s, --sobject=<value>...      (required) The name of an sobject to analyse.
      --api-version=<value>     Override the api version used for api requests made by this command
      --check-defaults          Checks if values differ from defaults.
      --check-history           Run additional checks with field history (if enabled)
      --custom-fields-only      Only analyse custom fields.
      --exclude-formulas        Only analyse non-formula fields.
      --segment-record-types    Segments the analysis by Record Types.
      --verbose                 Display a table of fields that were ignored during analysis.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Analyse the utilisation of fields for one or more sobjects.

  Retrieves the total number of records for an sobject, then each filterable field is analysed
  for how many records have a "non nullish" value. The following field types are supported:
  textarea, string, multipicklist, picklist, id, reference, date, datetime, time, boolean, phone, email, url, int,
  double, currency, percent.

EXAMPLES
  Analyse all fields for Account and MyCustomObject__c object

    $ sf jsc maintain field-usage analyse -o MyTargetOrg -s Account -s MyCustomObject__c

  Analyse only custom fields for Account object

    $ sf jsc maintain field-usage analyse -o MyTargetOrg -s Account --custom-fields-only

  Analyse all fields, but exclude formulas for Order object

    $ sf jsc maintain field-usage analyse -o MyTargetOrg -s Order --exclude-formulas

FLAG DESCRIPTIONS
  -r, --result-format=human|csv|markdown  Change the display formatting of output tables.

    Changes output format of table results that are printed to stdout. Use a format that is easier to copy-paste or
    export into other programs that support the format. For example, use markdown to copy-paste table outputs to
    Obsidian or Confluence.

  -s, --sobject=<value>...  The name of an sobject to analyse.

    Specify this flag multiple times to analyse multiple sobjects with a single command execution.
    Use the full API name of the object.

  --check-defaults  Checks if values differ from defaults.

    Performs an additional check for all fields that have a default value configured. If the field has a default value
    configered,
    the analysis only counts a field as populated, if the value is different from the default. The analysis algorithm
    for fields
    without a default value does not change.

    The default values of record types are not analysed.

  --check-history  Run additional checks with field history (if enabled)

    Analyses history tracking for this field and checks total number of changes and the date time of the last change. If
    history
    tracking is not enabled for the SObject, this flag has no effect.

  --custom-fields-only  Only analyse custom fields.

    If omitted, the command analyses standard fields and custom fields of an object.

  --exclude-formulas  Only analyse non-formula fields.

    If omitted, the command analyses all field types, regardless if it is a calculated fields or not.
    If a field is calculated (a formula field), the type shows "formula (return value)".

  --segment-record-types  Segments the analysis by Record Types.

    Segmentation will run all checks per record type of the sobject. If the sobject does not have record types enabled,
    it will have
    no effect. All records are returned as "Master". The analysis (output tables and JSON result) is grouped by record
    type developer name.
    Segmentation significantly increases the number of API calls.

  --verbose  Display a table of fields that were ignored during analysis.

    Depending on the flags that were used (--custom-fields-only, --exclude-formulas) and the existing fields on the
    sobject,
    some fields are ignored during analysis. For more information on those fields, use this flag.
```

_See code: [src/commands/jsc/maintain/field-usage/analyse.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/maintain/field-usage/analyse.ts)_

## `sf jsc maintain flow-export obsolete`

Exports unpackaged obsolete flows from a target org.

```
USAGE
  $ sf jsc maintain flow-export obsolete -o <value> [--json] [--flags-dir <value>] [-f PackageXML|DestructiveChangesXML -d <value>]
    [--concise] [--api-version <value>]

FLAGS
  -d, --output-dir=<value>      Path where package manifests will be created.
  -f, --output-format=<option>  Specify in which manifest file the content is written.
                                <options: PackageXML|DestructiveChangesXML>
  -o, --target-org=<value>      (required) Target org to analyse.
      --api-version=<value>     Override the api version used for api requests made by this command
      --concise                 Summarize flow output table.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Exports unpackaged obsolete flows from a target org.

  Finds and exports inactive (Obsolete or Draft) versions of unpackaged flows. The active version is never included.
  This is a complimentary command to the garbage collector, which exclusively analyses packaged flows.

EXAMPLES
  Analyse MyTargetOrg and export all obsolete flow versions to destructiveChanges.xml in directory tmp/dev-obsolete.

    $ sf jsc maintain flow-export obsolete -o MyTargetOrg --output-dir tmp/dev-obsolete --output-format \
      DestructiveChangesXML

  Analyse MyTargetOrg and print a table with all obsolete flow versions

    $ sf jsc maintain flow-export obsolete -o MyTargetOrg

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Path where package manifests will be created.

    When provided, creates manifest file (package.xml) at the target location with all exported content. Use the
    --output-format flag to write contents to destructiveChanges.xml.

  -f, --output-format=PackageXML|DestructiveChangesXML  Specify in which manifest file the content is written.

    The default option prepares a package.xml with all exported components. If you specify DestructiveChangesXML, the
    command creates an empty package.xml and writes all components into destructiveChanges.xml. This flag only has an
    effect, if the output directory is set. No source is retrieved or deployed.

  --concise  Summarize flow output table.

    Instead of showing individual exported flow versions, show aggregated information with the flow name and the total
    number of versions. Only modifies the formatted output table, not the JSON output or generated package manifests.
```

_See code: [src/commands/jsc/maintain/flow-export/obsolete.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/maintain/flow-export/obsolete.ts)_

## `sf jsc maintain flow-export unused`

Exports unpackaged unused flows from a target org.

```
USAGE
  $ sf jsc maintain flow-export unused -o <value> [--json] [--flags-dir <value>] [-f PackageXML|DestructiveChangesXML -d <value>]
    [--concise] [--api-version <value>]

FLAGS
  -d, --output-dir=<value>      Path where package manifests will be created.
  -f, --output-format=<option>  Specify in which manifest file the content is written.
                                <options: PackageXML|DestructiveChangesXML>
  -o, --target-org=<value>      (required) Target org to analyse.
      --api-version=<value>     Override the api version used for api requests made by this command
      --concise                 Summarize flow output table.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Exports unpackaged unused flows from a target org.

  Finds versions from completely inactive flows that are not part of a package. The export contains all versions of the
  inactive flow. This is a complimentary command to the garbage collector, which exclusively analyses packaged flows.

EXAMPLES
  Analyse MyTargetOrg and export all unused flow versions to destructiveChanges.xml in tmp.

    $ sf jsc maintain flow-export unused -o MyTargetOrg --output-dir tmp --output-format DestructiveChangesXML

  Analyse MyTargetOrg and print a table with all unused flow versions

    $ sf jsc maintain flow-export unused -o MyTargetOrg

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Path where package manifests will be created.

    When provided, creates manifest file (package.xml) at the target location with all exported content. Use the
    --output-format flag to write contents to destructiveChanges.xml.

  -f, --output-format=PackageXML|DestructiveChangesXML  Specify in which manifest file the content is written.

    The default option prepares a package.xml with all exported components. If you specify DestructiveChangesXML, the
    command creates an empty package.xml and writes all components into destructiveChanges.xml. This flag only has an
    effect, if the output directory is set. No source is retrieved or deployed.

  --concise  Summarize flow output table.

    Instead of showing individual exported flow versions, show aggregated information with the flow name and the total
    number of versions. Only modifies the formatted output table, not the JSON output or generated package manifests.
```

_See code: [src/commands/jsc/maintain/flow-export/unused.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/maintain/flow-export/unused.ts)_

## `sf jsc maintain garbage collect`

Collect garbage on your org and export to json or package.xml for more actions.

```
USAGE
  $ sf jsc maintain garbage collect -o <value> [--json] [--flags-dir <value>] [-v <value>] [-m <value>...] [-p <value>...] [-f
    PackageXML|DestructiveChangesXML -d <value>] [--api-version <value>]

FLAGS
  -d, --output-dir=<value>        Path where package manifests will be created.
  -f, --output-format=<option>    Specify in which manifest file the content is written.
                                  <options: PackageXML|DestructiveChangesXML>
  -m, --metadata-type=<value>...  Only include specific metadata types in the result.
  -o, --target-org=<value>        (required) Target org to analyse.
  -p, --package=<value>...        Only include metadata from specific packages.
  -v, --devhub-org=<value>        Used to resolve package ids when garbage must be filtered by package (--package).
      --api-version=<value>       Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Collect garbage on your org and export to json or package.xml for more actions.

  Identifies left-overs from package upgrades. This includes deprecated components (custom fields, objects, layouts, etc
  that were removed from package content, but not deleted on target org after install), outdated flow versions, empty
  test suites, etc. The structured JSON output gives you insight into the metadata types still on the org and how they
  can be processed. You can optionally generate a package.xml or destructiveChanges.xml for further processing.

EXAMPLES
  $ sf jsc maintain garbage collect -o Production --json

  $ sf jsc maintain garbage collect -o Production -d my-package-dir

  $ sf jsc maintain garbage collect -o Production -m ExternalString -m CustomObject

  $ sf jsc maintain garbage collect -o Production -m ExternalString -p SalesCRM -d tmp/test-run

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Path where package manifests will be created.

    When provided, creates manifest file (package.xml) at the target location with all exported content. Use the
    --output-format flag to write contents to destructiveChanges.xml.

  -f, --output-format=PackageXML|DestructiveChangesXML  Specify in which manifest file the content is written.

    The default option prepares a package.xml with all exported components. If you specify DestructiveChangesXML, the
    command creates an empty package.xml and writes all components into destructiveChanges.xml. This flag only has an
    effect, if the output directory is set. No source is retrieved or deployed.

  -m, --metadata-type=<value>...  Only include specific metadata types in the result.

    Only provided metadata types are processed and added to "deprecated components" result. All other will be ignored.
    You can specify this flag multiple times. Use the developer name of the entity definition (e.g. ExternalString
    instead of CustomLabel). Values are case insensitive.

  -o, --target-org=<value>  Target org to analyse.

    The org that is queried for deprecated package members and outdated flow versions.

  -p, --package=<value>...  Only include metadata from specific packages.

    You can specify the package id (0Ho) or a local package alias from your sfdx-project.json to narrow down package
    members only from a specific package. You can specify this flag multiple times.

  -v, --devhub-org=<value>  Used to resolve package ids when garbage must be filtered by package (--package).

    Package filters are set with the "0Ho"-Id of the Package2 container. The DevHub is needed to resolve these ids to
    the canonical "033" Ids. If your target org is a devhub, it will automatically be used. This parameter is only
    needed, if you specify at least one package flag.
```

_See code: [src/commands/jsc/maintain/garbage/collect.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/maintain/garbage/collect.ts)_

## `sf jsc manifest rollout`

Roll out a manifest. This deploys the artifacts of the manifest (unpackaged, package, etc) to the target org.

```
USAGE
  $ sf jsc manifest rollout -m <value> -t <value> -o <value> [--json] [--flags-dir <value>] [--validate-only]
    [--api-version <value>]

FLAGS
  -m, --manifest=<value>     (required) A manifest file that defines the desired state of the target org
  -o, --devhub-org=<value>   (required) Devhub that owns the packages. Needed to resolve package versions.
  -t, --target-org=<value>   (required) Target org (sandbox, production, etc) where artifacts of the manifest should be
                             rolled out.
      --api-version=<value>  Override the api version used for api requests made by this command
      --validate-only        Only validate the manifest file, do not perform any rollout actions like package installs
                             or source deploys.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Roll out a manifest. This deploys the artifacts of the manifest (unpackaged, package, etc) to the target org.

  The command takes an Org Manifest and rolls out its artifacts to a target org. Dynamic paths for unpackaged artifacts
  are resolved based on mapped environments, package versions are resolved based on the DevHub org.

EXAMPLES
  $ sf jsc manifest rollout
```

_See code: [src/commands/jsc/manifest/rollout.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/manifest/rollout.ts)_

## `sf jsc manifest validate`

Validate a manifest file. Same result as running "rollout" with "--validate-only".

```
USAGE
  $ sf jsc manifest validate -m <value> -t <value> -o <value> [--json] [--flags-dir <value>]

FLAGS
  -m, --manifest=<value>    (required) A manifest file that defines the desired state of the target org
  -o, --devhub-org=<value>  (required) Devhub that owns the packages. Needed to resolve package versions.
  -t, --target-org=<value>  (required) Target org (sandbox, production, etc) where artifacts of the manifest should be
                            rolled out.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate a manifest file. Same result as running "rollout" with "--validate-only".

  The manifest file is validated against a DevHub and Target Org. It tries to resolve package versions and deploy paths
  for all artifacts, but does not attempt to rollout the artifacts to the target org.

  All artifacts are returned as RESOLVED, if validation succeeds.

EXAMPLES
  $ sf jsc manifest validate
```

_See code: [src/commands/jsc/manifest/validate.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.18.0/src/commands/jsc/manifest/validate.ts)_

<!-- commandsstop -->

## Development and Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com/j-schreiber/js-sf-cli-plugin

# Install the dependencies and compile
yarn && yarn build
```

To use the local build, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev.js hello world
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```
