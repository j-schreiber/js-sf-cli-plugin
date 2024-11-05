import { Config } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import { ZArtifactDeployResultType, ZManifestDeployResultType } from '../../../types/orgManifestOutputSchema.js';
import { eventBus } from '../../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../common/comms/processingEvents.js';
import OrgManifest from '../../../release-manifest/OrgManifest.js';
import { DeployStatus } from '../../../types/orgManifestGlobalConstants.js';

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
  public static readonly requiresProject = true;

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
    }),
  };

  public constructor(argv: string[], config: Config) {
    super(argv, config);
    eventBus.on('manifestRollout', (payload: CommandStatusEvent) => this.handleStatusEvent(payload));
    eventBus.on('simpleMessage', (payload: CommandStatusEvent) => this.log(payload.message));
  }

  public async run(): Promise<JscManifestRolloutResult> {
    const { flags } = await this.parse(JscManifestRollout);
    const manifest = ReleaseManifestLoader.load(flags.manifest);
    await manifest.resolve(flags['target-org'].getConnection('60.0'), flags['devhub-org'].getConnection('60.0'));
    const result = await this.deployArtifacts(manifest);
    return {
      targetOrgUsername: flags['target-org'].getUsername(),
      devhubOrgUsername: flags['devhub-org'].getUsername(),
      deployedArtifacts: result,
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
    for (const artifact of manifest.getDeployJobs()) {
      const jobResults: ZArtifactDeployResultType[] = [];
      this.spinner.start(`Rolling out ${artifact.name} (${artifact.getSteps().length} steps).`);
      this.spinner.status = 'Testing message';
      for (let i = 0; i < artifact.getSteps().length; i++) {
        const step = artifact.getSteps()[i];
        const stepStatus = step.getStatus();
        this.spinner.status = `Running ${stepStatus.deployStrategy!} (Step ${i + 1} of ${artifact.getSteps().length})`;
        // eslint-disable-next-line no-await-in-loop
        const stepResult = await step.deploy();
        if (stepResult.status === DeployStatus.Enum.Failed) {
          this.error(JSON.stringify(stepResult.errorDetails, null, 2));
        }
        this.spinner.status = stepResult.displayMessage;
        jobResults.push(stepResult);
      }
      this.spinner.stop(this.buildStopMsgForArtifactCompletion(artifact.getAggregatedStatus()));
      result[artifact.name] = jobResults;
    }
    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  private buildStopMsgForArtifactCompletion(artifactStatus: string): string {
    if (artifactStatus === DeployStatus.Enum.Skipped) {
      return 'Artifact skipped.';
    }
    if (artifactStatus === DeployStatus.Enum.Failed) {
      return 'FAILED!';
    }
    return `Completed with ${artifactStatus.toLowerCase()}.`;
  }
}
