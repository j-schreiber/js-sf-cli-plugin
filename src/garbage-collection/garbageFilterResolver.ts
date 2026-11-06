import { Connection, Messages, Org, SfError, SfProject } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const genericMessages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

type InfoLogger = (message: string) => void;

const PACKAGE_ID_PREFIXES = ['0Ho', '033'];

/**
 * Resolves aliases from sfdx-project.json to package ids (0Ho). Package ids (0Ho),
 * subscriber package ids (033) and all values that are not an alias (e.g. package
 * names) are returned unchanged and resolved by the garbage collector.
 */
export async function resolvePackageIds(info: InfoLogger, packages?: string[]): Promise<string[] | undefined> {
  if (packages === undefined) {
    return undefined;
  }
  const isId = (pkg: string): boolean => PACKAGE_ID_PREFIXES.some((prefix) => pkg.startsWith(prefix));
  if (packages.every(isId)) {
    return packages;
  }
  const project = await resolveProject(info);
  return packages.map((pkg) => {
    if (isId(pkg)) {
      return pkg;
    }
    const aliasedId = project?.getPackageIdFromAlias(pkg);
    return aliasedId?.startsWith('0Ho') ? aliasedId : pkg;
  });
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
