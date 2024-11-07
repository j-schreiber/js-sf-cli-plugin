import { Connection, Messages, SfError } from '@salesforce/core';
import { Package2Version, SubscriberPackageVersion } from '../../types/sfToolingApiTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('jsc', 'orgmanifest');

export async function resolvePackageVersionId(
  packageVersionLiteral: string,
  packageId: string,
  devhubCon: Connection
): Promise<PackageVersionDetails> {
  const versionArray = packageVersionLiteral.split('.');
  const queryString = `SELECT 
    SubscriberPackageVersionId,
    Package2.SubscriberPackageId,
    SubscriberPackageVersion.IsBeta,
    SubscriberPackageVersion.IsPasswordProtected 
    FROM Package2Version 
    WHERE Package2Id = '${packageId}'
      AND MajorVersion = ${versionArray[0]} 
      AND MinorVersion = ${versionArray[1]} 
      AND PatchVersion = ${versionArray[2]} 
      AND IsReleased = true LIMIT 1`;
  const queryResult = await devhubCon.tooling.query(queryString);
  if (queryResult.records.length === 0) {
    throw new SfError(
      messages.getMessage('errors.no-released-package-version', [
        packageId,
        packageVersionLiteral,
        devhubCon.getUsername(),
      ]),
      'NoReleasedPackageVersionFound'
    );
  }
  const record = queryResult.records[0] as Package2Version;
  return {
    id: record.SubscriberPackageVersionId,
    requiresInstallationKey: record.SubscriberPackageVersion.IsPasswordProtected,
    subscriberPackageId: record.Package2.SubscriberPackageId,
  };
}

export async function resolveInstalledVersionId(
  subscriberId: string,
  targetOrgCon: Connection
): Promise<PackageVersionDetails> {
  const queryString = `SELECT
    SubscriberPackageVersionId,
    SubscriberPackageVersion.MajorVersion,
    SubscriberPackageVersion.MinorVersion,
    SubscriberPackageVersion.PatchVersion,
    SubscriberPackageVersion.IsPasswordProtected
    FROM InstalledSubscriberPackage
    WHERE SubscriberPackageId = '${subscriberId}' LIMIT 1`;
  const queryResult = await targetOrgCon.tooling.query(queryString);
  if (queryResult.records.length === 0) {
    return { id: undefined };
  }
  const record = queryResult.records[0] as Package2Version;
  return {
    id: record.SubscriberPackageVersionId,
    versionName: mergeVersionName(record.SubscriberPackageVersion),
    requiresInstallationKey: record.SubscriberPackageVersion.IsPasswordProtected,
  };
}

function mergeVersionName(subscriberPackage: SubscriberPackageVersion): string {
  return `${subscriberPackage.MajorVersion}.${subscriberPackage.MinorVersion}.${subscriberPackage.PatchVersion}`;
}

export type PackageVersionDetails = {
  id?: string;
  versionName?: string;
  requiresInstallationKey?: boolean;
  subscriberPackageId?: string;
};
