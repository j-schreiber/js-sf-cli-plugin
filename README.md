# @j-schreiber/sf-plugin

[![NPM](https://img.shields.io/npm/v/@j-schreiber/sf-plugin.svg?label=@j-schreiber/sf-plugin)](https://www.npmjs.com/package/@j-schreiber/sf-plugin) [![Downloads/week](https://img.shields.io/npm/dw/@j-schreiber/sf-plugin.svg)](https://npmjs.org/package/@j-schreiber/sf-plugin) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/@j-schreiber/sf-plugin/main/LICENSE.txt)

> This plugin is in early beta. Use it with care, as command signatures may change. It still lacks some functionality (but the commands are stable and bug free ;).

Looking for documentation? It's still a work in progress, visit [GitHub Wiki](https://github.com/j-schreiber/js-sf-cli-plugin/wiki).

## Installation

The plugin is not digitally signed, so in order to avoid the prompt on installation, add it to your [`unsignedPluginAllowList.json`](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_allowlist.htm). If you don't mind the prompt, simply run:

```bash
sf plugins install @j-schreiber/sf-plugin
```

## Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com/j-schreiber/js-sf-cli-plugin

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

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

## Contribute

Contributers are welcome! Please reach out on [Linkedin](https://www.linkedin.com/in/jannis-schreiber/) or via [Email](mailto:info@lietzau-consulting.de).

## Commands

<!-- commands -->

- [`sf jsc data export`](#sf-jsc-data-export)
- [`sf jsc maintain garbage collect`](#sf-jsc-maintain-garbage-collect)
- [`sf jsc manifest rollout`](#sf-jsc-manifest-rollout)
- [`sf jsc manifest validate`](#sf-jsc-manifest-validate)

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

_See code: [src/commands/jsc/data/export.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.6.0/src/commands/jsc/data/export.ts)_

## `sf jsc maintain garbage collect`

Collect garbage on your org and export to json or package.xml for more actions.

```
USAGE
  $ sf jsc maintain garbage collect -o <value> [--json] [--flags-dir <value>] [-v <value>] [-m <value>...] [-p <value>...] [-f
    PackageXML|DestructiveChangesXML -d <value>] [--api-version <value>]

FLAGS
  -d, --output-dir=<value>        Provide the path of the manifest to create.
  -f, --output-format=<option>    Specify the type of manifest to create.
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
  -d, --output-dir=<value>  Provide the path of the manifest to create.

    When provided, the command creates a manifest file (package.xml) at the target location.

  -f, --output-format=PackageXML|DestructiveChangesXML  Specify the type of manifest to create.

    The default option prepares a package.xml with all deprecated components. If you specify DestructiveChangesXML, the
    command creates an empty package.xml and writes all components into destructiveChanges. This flag only has an
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

_See code: [src/commands/jsc/maintain/garbage/collect.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.6.0/src/commands/jsc/maintain/garbage/collect.ts)_

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

_See code: [src/commands/jsc/manifest/rollout.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.6.0/src/commands/jsc/manifest/rollout.ts)_

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

_See code: [src/commands/jsc/manifest/validate.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.6.0/src/commands/jsc/manifest/validate.ts)_

<!-- commandsstop -->
