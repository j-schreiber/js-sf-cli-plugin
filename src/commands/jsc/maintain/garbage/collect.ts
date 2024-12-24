import fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org, SfError, SfProject } from '@salesforce/core';
import { Package } from '@salesforce/packaging';
import GarbageCollector from '../../../../garbage-collection/garbageCollector.js';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';
import { PackageGarbageResult } from '../../../../garbage-collection/packageGarbageTypes.js';
import PackageXmlBuilder from '../../../../garbage-collection/packageXmlBuilder.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.garbage.collect');

export default class JscMaintainGarbageCollect extends SfCommand<PackageGarbageResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'devhub-org': Flags.optionalHub({
      summary: messages.getMessage('flags.devhub-org.summary'),
      description: messages.getMessage('flags.devhub-org.description'),
      char: 'v',
      required: false,
    }),
    'output-dir': Flags.file({
      exists: false,
      summary: messages.getMessage('flags.output-dir.summary'),
      description: messages.getMessage('flags.output-dir.description'),
      char: 'd',
    }),
    'metadata-type': Flags.string({
      multiple: true,
      char: 'm',
      summary: messages.getMessage('flags.metadata-type.summary'),
      description: messages.getMessage('flags.metadata-type.description'),
    }),
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      multiple: true,
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<PackageGarbageResult> {
    const { flags } = await this.parse(JscMaintainGarbageCollect);
    const orgConnection = flags['target-org'].getConnection(flags['api-version']);
    const devhubConnection = resolveDevhub(flags['target-org'], flags['devhub-org'], flags['api-version']);
    const collector = GarbageCollector.newInstance(orgConnection, devhubConnection);
    collector.on('resolveMemberStatus', (payload: CommandStatusEvent) => {
      this.info(payload.message!);
    });
    const deprecatedPackageMembers = await collector.export({
      includeOnly: flags['metadata-type'],
      packages: await this.resolvePackageIds(orgConnection, flags.package),
    });
    await this.writePackageXml(deprecatedPackageMembers, flags['output-dir']);
    process.exitCode = 0;
    return deprecatedPackageMembers;
  }

  private async writePackageXml(collectedGarbage: PackageGarbageResult, outputPath?: string): Promise<void> {
    if (outputPath === undefined) {
      return;
    }
    this.info(`Writing package.xml to: ${outputPath}`);
    const packageXml = await PackageXmlBuilder.parseGarbageResultToXml(collectedGarbage);
    fs.mkdirSync(outputPath, { recursive: true });
    fs.writeFileSync(`${outputPath}/package.xml`, packageXml);
  }

  private async resolvePackageIds(connection: Connection, idsOrAliase?: string[]): Promise<string[] | undefined> {
    if (idsOrAliase === undefined) {
      return undefined;
    }
    const ids: string[] = [];
    const project = await this.resolveProject();
    idsOrAliase.forEach((idOrAlias) => {
      const pgk = new Package({ packageAliasOrId: idOrAlias, connection, project });
      ids.push(pgk.getId());
    });
    return ids;
  }

  private async resolveProject(): Promise<SfProject | undefined> {
    try {
      return await SfProject.resolve();
    } catch (err) {
      if (err instanceof SfError) {
        this.info(`Could not initialise project with the following error: ${err.name}`);
      } else {
        this.info('Unknown error when trying to initialise project. Skipping.');
      }
      this.info("Package aliases are not supported. Use the '0Ho' Id instead.");
    }
    return undefined;
  }
}

function resolveDevhub(targetOrg: Org, devhubOrg?: Org, apiVersion?: string): Connection | undefined {
  if (devhubOrg && !devhubOrg.isDevHubOrg()) {
    throw new SfError(`Not a devhub org: ${devhubOrg.getUsername()!}`, 'NoValidDevhub');
  }
  if (targetOrg.isDevHubOrg() && !devhubOrg) {
    return targetOrg.getConnection(apiVersion);
  }
  return devhubOrg?.getConnection(apiVersion);
}
