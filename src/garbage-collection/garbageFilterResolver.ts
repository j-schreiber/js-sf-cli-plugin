import { Connection, Messages, Org, SfError, SfProject } from '@salesforce/core';
import { Package } from '@salesforce/packaging';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const genericMessages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

type InfoLogger = (message: string) => void;

/**
 * Resolves package ids or aliases (from sfdx-project.json) to Package2 ids (0Ho).
 */
export async function resolvePackageIds(
  connection: Connection,
  info: InfoLogger,
  idsOrAliase?: string[]
): Promise<string[] | undefined> {
  if (idsOrAliase === undefined) {
    return undefined;
  }
  const project = await resolveProject(info);
  return idsOrAliase.map((idOrAlias) => new Package({ packageAliasOrId: idOrAlias, connection, project }).getId());
}

/**
 * Resolves the devhub connection. Falls back to target org, if it is a devhub.
 */
export function resolveDevhub(targetOrg: Org, devhubOrg?: Org, apiVersion?: string): Connection | undefined {
  if (devhubOrg && !devhubOrg.isDevHubOrg()) {
    throw new SfError(`Not a devhub org: ${devhubOrg.getUsername()!}`, 'NoValidDevhub');
  }
  if (targetOrg.isDevHubOrg() && !devhubOrg) {
    return targetOrg.getConnection(apiVersion);
  }
  return devhubOrg?.getConnection(apiVersion);
}

async function resolveProject(info: InfoLogger): Promise<SfProject | undefined> {
  try {
    return await SfProject.resolve();
  } catch (err) {
    if (err instanceof SfError) {
      info(genericMessages.getMessage('infos.not-a-sfdx-project', [err.name]));
    } else {
      info(genericMessages.getMessage('infos.unknown-error-initialising-project'));
    }
    info(genericMessages.getMessage('infos.package-aliases-not-supported'));
  }
  return undefined;
}
