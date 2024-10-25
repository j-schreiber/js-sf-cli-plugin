import fs from 'node:fs';
import yaml from 'js-yaml';
import { ZReleaseManifest, ZReleaseManifestType } from '../types/releaseManifest.js';

export default class ReleaseManifestLoader {
  public static loadManifest(filePath: string): ZReleaseManifestType {
    const yamlContent = yaml.load(fs.readFileSync(filePath, 'utf8')) as ZReleaseManifestType;
    return ZReleaseManifest.parse(yamlContent);
  }
}
