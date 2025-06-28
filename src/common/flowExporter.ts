import { Connection } from '@salesforce/core';
import { FlowVersionDefinition } from '../types/sfToolingApiTypes.js';
import { OutputFormats } from './jscSfCommandFlags.js';
import PackageManifestDirectory from './packageManifestDirectory.js';

/**
 * Inactive flow versions from flows that have at least one active version. Includes
 * Draft and Obsolete.
 */
const OBSOLETE_FLOW_VERSIONS = `SELECT Id,DefinitionId,Definition.DeveloperName,Status,ProcessType,VersionNumber
FROM Flow
WHERE
  DefinitionId NOT IN (SELECT Id FROM FlowDefinition WHERE ActiveVersionId = NULL)
  AND Status IN ('Obsolete','Draft','InvalidDraft')
  AND ManageableState IN ('unmanaged')
ORDER BY Definition.DeveloperName,VersionNumber`;

/**
 * Flow versions from completely unused flows (e.g. no version is activated).
 */
const UNUSED_FLOW_VERSIONS = `SELECT Id,DefinitionId,Definition.DeveloperName,Status,ProcessType,VersionNumber
FROM Flow
WHERE
  DefinitionId IN (SELECT Id FROM FlowDefinition WHERE ActiveVersionId = NULL)
  AND ManageableState IN ('unmanaged')
ORDER BY Definition.DeveloperName,VersionNumber`;

export default class FlowExporter {
  public constructor(public readonly targetOrg: Connection) {}

  public async exportUnusedFlows(): Promise<FlowClutter[]> {
    const unusedFlowVersions = await this.targetOrg.tooling.query<FlowVersionDefinition>(UNUSED_FLOW_VERSIONS);
    return flatten(unusedFlowVersions.records);
  }

  public async exportObsoleteFlows(): Promise<FlowClutter[]> {
    const obsoleteFlowVersions = await this.targetOrg.tooling.query<FlowVersionDefinition>(OBSOLETE_FLOW_VERSIONS);
    return flatten(obsoleteFlowVersions.records);
  }
}

export function writeFlowsToXml(flowVersions: FlowClutter[], outputPath: string, outputFormat?: OutputFormats): void {
  const outputDir = new PackageManifestDirectory(outputPath, outputFormat);
  flowVersions.forEach((version) => {
    outputDir.getBuilder().addMember('Flow', `${version.DeveloperName}-${version.VersionNumber}`);
  });
  outputDir.write();
}

function flatten(flowVersions: FlowVersionDefinition[]): FlowClutter[] {
  // eslint-disable-next-line arrow-body-style
  return flowVersions.map((version) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { Definition, DefinitionId, attributes, ...expandedVersion } = version;
    return {
      DeveloperName: version.Definition.DeveloperName,
      ...expandedVersion,
    };
  });
}

export type FlowClutter = {
  DeveloperName: string;
  ProcessType: string;
  VersionNumber: number;
  Status: string;
  Id: string;
};
