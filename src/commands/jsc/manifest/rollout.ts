import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { ArtifactDeployResult } from '../../../release-manifest/manifestRolloutResult.js';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import ReleaseManifest from '../../../release-manifest/releaseManifest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('jsc', 'jsc.manifest.rollout');

export type RolloutResult = {
  targetOrgUsername?: string;
  devhubOrgUsername?: string;
  deployedArtifacts: ArtifactDeployResult[];
};

export default class Rollout extends SfCommand<RolloutResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'manifest-file': Flags.file({
      summary: messages.getMessage('flags.manifest-file.summary'),
      char: 'm',
      required: true,
      exists: true,
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 't',
      required: true,
    }),
    'devhub-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.devhub-org.summary'),
      char: 'o',
      required: true,
    }),
  };

  public async run(): Promise<RolloutResult> {
    const { flags } = await this.parse(Rollout);
    const manifest = new ReleaseManifest(
      ReleaseManifestLoader.load(flags['manifest-file']),
      flags['devhub-org'].getConnection('60.0')
    );
    const deployResult = await manifest.rollout(flags['target-org'].getConnection('60.0'));
    return {
      targetOrgUsername: flags['target-org'].getUsername(),
      devhubOrgUsername: flags['devhub-org'].getUsername(),
      deployedArtifacts: deployResult,
    };
  }
}
