import fs from 'node:fs';
import yaml from 'js-yaml';
import { Messages, SfError } from '@salesforce/core';
import { ZReleaseManifest, ZReleaseManifestType } from '../types/orgManifestInputSchema.js';
import OrgManifest from './OrgManifest.js';

const messages = Messages.loadMessages('jsc', 'orgmanifest');
export default class ReleaseManifestLoader {
  public static load(filePath: string): OrgManifest {
    if (fs.existsSync(filePath)) {
      const yamlContent = yaml.load(fs.readFileSync(filePath, 'utf8')) as ZReleaseManifestType;
      const manifestType = ZReleaseManifest.parse(yamlContent);
      ReleaseManifestLoader.parseArtifactPaths(manifestType);
      return new OrgManifest(manifestType);
    } else {
      throw new SfError(`Invalid path, file does not exist: ${filePath}`);
    }
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
        throw new SfError(`Error parsing artifact "${artifactName}": "${env}" is not defined in environments.`);
      }
    });
  }

  private static assertPathExists(path: string, artifactName: string): void {
    if (!fs.existsSync(path)) {
      throw new SfError(`Error parsing artifact "${artifactName}": ${path} does not exist.`);
    }
    const dirContent = fs.readdirSync(path, { recursive: true });
    let hasFiles = false;
    dirContent.forEach((dirContentPath) => {
      hasFiles = hasFiles || !fs.lstatSync(`${path}/${String(dirContentPath)}`).isDirectory();
    });
    if (!hasFiles) {
      throw new SfError(messages.getMessage('source-path-is-empty', [artifactName, path]));
    }
  }
}
