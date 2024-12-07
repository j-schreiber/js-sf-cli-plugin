/* eslint-disable no-await-in-loop */
import { Config } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import { ZManifestDeployResultType } from '../../../types/orgManifestOutputSchema.js';
import { eventBus } from '../../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../common/comms/processingEvents.js';
import OrgManifest from '../../../release-manifest/OrgManifest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.manifest.rollout');

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
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
      char: 'v',
      hidden: true,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public constructor(argv: string[], config: Config) {
    super(argv, config);
    eventBus.on('manifestRollout', (payload: CommandStatusEvent) => this.handleStatusEvent(payload));
    eventBus.on('simpleMessage', (payload: CommandStatusEvent) => this.log(payload.message));
  }

  public async run(): Promise<JscManifestRolloutResult> {
    const { flags } = await this.parse(JscManifestRollout);
    this.info(messages.getMessage('infos.target-org-info', [flags['target-org'].getUsername()]));
    this.info(messages.getMessage('infos.devhub-org-info', [flags['devhub-org'].getUsername()]));
    const manifest = ReleaseManifestLoader.load(flags.manifest);
    const resolveResults = await manifest.resolve(
      flags['target-org'].getConnection('60.0'),
      flags['devhub-org'].getConnection('60.0')
    );
    if (flags['validate-only']) {
      return {
        targetOrgUsername: flags['target-org'].getUsername(),
        devhubOrgUsername: flags['devhub-org'].getUsername(),
        deployedArtifacts: resolveResults,
      };
    }
    const deployResults = await this.deployArtifacts(manifest);
    return {
      targetOrgUsername: flags['target-org'].getUsername(),
      devhubOrgUsername: flags['devhub-org'].getUsername(),
      deployedArtifacts: deployResults,
    };
  }

  private handleStatusEvent(payload: CommandStatusEvent): void {
    if (payload.status === ProcessingStatus.Started) {
      this.spinner.start(payload.message!);
    }
    this.spinner.status = payload.message;
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop(payload.message);
    }
  }

  private async deployArtifacts(manifest: OrgManifest): Promise<ZManifestDeployResultType> {
    const result: ZManifestDeployResultType = {};
    let isFailing = false;
    for (const artifact of manifest.getDeployJobs()) {
      artifact.on('artifactDeployStart', (payload: CommandStatusEvent) => {
        this.spinner.start(payload.message!);
      });
      artifact.on('artifactDeployProgress', (payload: CommandStatusEvent) => {
        this.spinner.status = payload.message;
      });
      artifact.on('artifactDeployCompleted', (payload: CommandStatusEvent) => {
        this.spinner.stop(payload.message);
        if (process.exitCode === undefined || process.exitCode === 0) {
          process.exitCode = payload.exitCode;
        }
        if (payload.exitCode && payload.exitCode > 0) {
          isFailing = true;
          if (this.jsonEnabled()) {
            process.exitCode = 2;
          } else {
            this.error(JSON.stringify(payload.exitDetails, null, 2));
          }
        }
      });
      artifact.skipAll = isFailing;
      result[artifact.name] = await artifact.deploy();
    }
    return result;
  }
}
