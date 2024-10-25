import fs from 'node:fs';
import yaml from 'js-yaml';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { ReleaseManifest } from '../../../types/releaseManifest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('jsc', 'jsc.manifest.rollout');

export type RolloutResult = {
  path: string;
};

export default class Rollout extends SfCommand<RolloutResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
    manifest: Flags.file({
      summary: messages.getMessage('flags.manifest.summary'),
      char: 'm',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<RolloutResult> {
    const { flags } = await this.parse(Rollout);
    const yamlContent: ReleaseManifest = yaml.load(fs.readFileSync(flags.manifest, 'utf8')) as ReleaseManifest;
    const packages = new Map(Object.entries(yamlContent.packages));
    packages.forEach((packageData, packageName) => {
      this.log(`>>> ${packageName}`);
      this.log(`Version: ${packageData.version}`);
      this.log(`Type: ${packageData.type}`);
      this.log(`Skip if Installed: ${packageData.skip_if_installed}`);
      this.log(`Package Id: ${packageData.package_id}`);
      this.log(`Has overrides: ${packageData.overrides !== undefined}`);
      if (packageData.overrides !== undefined) {
        if (typeof packageData.overrides === 'string') {
          this.log(`Deploy path ${packageData.overrides} to all envs`);
        } else {
          const overrides = new Map(Object.entries(packageData.overrides));
          overrides.forEach((sourcePath, localEnv) => {
            this.log(`Deploy path ${sourcePath} to ${localEnv}`);
          });
        }
      }
    });
    const envs = new Map(Object.entries(yamlContent.environments));
    envs.forEach((envUsername, localEnvName) => {
      this.log(`Use ${localEnvName} for ${envUsername}`);
    });
    return {
      path: 'src/commands/rollout.ts',
    };
  }
}
