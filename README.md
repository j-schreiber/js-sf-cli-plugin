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
- [`sf jsc manifest rollout`](#sf-jsc-manifest-rollout)

## `sf jsc data export`

Export all data from a plan definition.

```
USAGE
  $ sf jsc data export -o <value> -p <value> [--json] [--flags-dir <value>] [-d <value>] [-v]

FLAGS
  -d, --output-dir=<value>  Output directory to export all fields.
  -o, --source-org=<value>  (required) The source org from where data is exported.
  -p, --plan=<value>        (required) Path to the plan file that defines the export.
  -v, --validate-only       Does not retrieve records. Only validates the plan.

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

_See code: [src/commands/jsc/data/export.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.1.3/src/commands/jsc/data/export.ts)_

## `sf jsc manifest rollout`

Roll out a manifest. This deploys the artifacts of the manifest (unpackaged, package, etc) to the target org.

```
USAGE
  $ sf jsc manifest rollout -m <value> -t <value> -o <value> [--json] [--flags-dir <value>] [-v]

FLAGS
  -m, --manifest=<value>    (required) A manifest file that defines the desired state of the target org
  -o, --devhub-org=<value>  (required) Devhub that owns the packages. Needed to resolve package versions.
  -t, --target-org=<value>  (required) Target org (sandbox, production, etc) where artifacts of the manifest should be
                            rolled out.
  -v, --verbose             Placeholder - Prints all subcommand outputs to terminal (e.g. deployed source files, package
                            install status, etc)

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

_See code: [src/commands/jsc/manifest/rollout.ts](https://github.com/j-schreiber/js-sf-cli-plugin/blob/v0.1.3/src/commands/jsc/manifest/rollout.ts)_

<!-- commandsstop -->
