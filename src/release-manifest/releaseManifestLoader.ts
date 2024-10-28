import fs from 'node:fs';
import yaml from 'js-yaml';
import { ZReleaseManifest, ZReleaseManifestType } from '../types/releaseManifest.js';
import OrgManifest from './OrgManifest.js';

export default class ReleaseManifestLoader {
  public static load(filePath: string): OrgManifest {
    if (fs.existsSync(filePath)) {
      const yamlContent = yaml.load(fs.readFileSync(filePath, 'utf8')) as ZReleaseManifestType;
      const manifestType = ZReleaseManifest.parse(yamlContent);
      ReleaseManifestLoader.parsePathsWithEnvironments(manifestType);
      return new OrgManifest(manifestType);
    } else {
      throw new Error(`Invalid path, file does not exist: ${filePath}`);
    }
  }

  private static parsePathsWithEnvironments(manifestType: ZReleaseManifestType): void {
    for (const [artifactName, artifact] of Object.entries(manifestType.artifacts)) {
      if (artifact.type === 'Unpackaged') {
        if (typeof artifact.path != 'string') {
          Object.keys(artifact.path).forEach((env) => {
            if (manifestType.environments && !(env in manifestType.environments)) {
              throw new Error(`Error parsing artifact "${artifactName}": "${env}" is not defined in environments.`);
            }
          });
        }
      }
    }
  }
}
