import fs from 'node:fs';
import { Messages, SfError } from '@salesforce/core';
import { ZReleaseManifest, ZReleaseManifestType } from '../types/orgManifestInputSchema.js';
import { parseYaml, pathHasNoFiles } from '../common/utils/fileUtils.js';
import OrgManifest from './OrgManifest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'orgmanifest');

export default class ReleaseManifestLoader {
  public static load(filePath: string): OrgManifest {
    const manifestType = parseYaml<typeof ZReleaseManifest>(filePath, ZReleaseManifest);
    ReleaseManifestLoader.parseArtifactPaths(manifestType);
    return new OrgManifest(manifestType);
  }

  private static parseArtifactPaths(manifestType: ZReleaseManifestType): void {
    for (const [artifactName, artifact] of Object.entries(manifestType.artifacts)) {
      if (artifact.type === 'Unpackaged') {
        if (!artifact.path) {
          continue;
        }
        if (typeof artifact.path != 'string') {
          ReleaseManifestLoader.assertPathEnvironmentMapping(artifact.path, manifestType.environments!, artifactName);
          Object.values(artifact.path).forEach((value) => {
            ReleaseManifestLoader.assertPathExists(value, artifactName);
          });
        } else if (typeof artifact.path === 'string') {
          ReleaseManifestLoader.assertPathExists(artifact.path, artifactName);
        }
      }
    }
  }

  private static assertPathEnvironmentMapping(
    pathsObject: Record<string, string>,
    envs: Record<string, string>,
    artifactName: string
  ): void {
    Object.keys(pathsObject).forEach((env) => {
      if (envs && !(env in envs)) {
        throw new SfError(
          `Error parsing artifact "${artifactName}": "${env}" is not defined in environments.`,
          'UnknownEnvironmentMapped'
        );
      }
    });
  }

  private static assertPathExists(path: string, artifactName: string): void {
    if (!fs.existsSync(path)) {
      throw new SfError(`Error parsing artifact "${artifactName}": ${path} does not exist.`, 'NoOrEmptySourcePath');
    }
    if (pathHasNoFiles(path)) {
      throw new SfError(
        messages.getMessage('errors.source-path-is-empty', [artifactName, path]),
        'NoOrEmptySourcePath'
      );
    }
  }
}
