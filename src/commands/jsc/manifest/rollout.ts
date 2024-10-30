import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import { ZManifestDeployResultType } from '../../../types/orgManifestOutputSchema.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('jsc', 'jsc.manifest.rollout');

export type JscManifestRolloutResult = {
  targetOrgUsername?: string;
  devhubOrgUsername?: string;
  deployedArtifacts: ZManifestDeployResultType;
};

export default class JscManifestRollout extends SfCommand<JscManifestRolloutResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    manifest: Flags.file({
      summary: messages.getMessage('flags.manifest.summary'),
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

  public async run(): Promise<JscManifestRolloutResult> {
    const { flags } = await this.parse(JscManifestRollout);
    const manifest = ReleaseManifestLoader.load(flags.manifest);
    const result = await manifest.rollout(
      flags['target-org'].getConnection('60.0'),
      flags['devhub-org'].getConnection('60.0')
    );
    return {
      targetOrgUsername: flags['target-org'].getUsername(),
      devhubOrgUsername: flags['devhub-org'].getUsername(),
      deployedArtifacts: result,
    };
  }
}
