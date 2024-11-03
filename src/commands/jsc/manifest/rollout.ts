import { Config } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ReleaseManifestLoader from '../../../release-manifest/releaseManifestLoader.js';
import { ZArtifactDeployResultType, ZManifestDeployResultType } from '../../../types/orgManifestOutputSchema.js';
import { eventBus } from '../../../common/comms/eventBus.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../common/comms/processingEvents.js';
import OrgManifest from '../../../release-manifest/OrgManifest.js';
import { DeployStatus } from '../../../types/orgManifestGlobalConstants.js';
import OclifUtils from '../../../common/utils/wrapChildprocess.js';

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
    // process all artifacts in a totally generic manner
    // create artifact deploy results & runs the deploy config
    const result: ZManifestDeployResultType = {};
    for (const job of manifest.getDeployJobs()) {
      const jobResults: ZArtifactDeployResultType[] = [];
      this.log(`Starting rollout for ${job.name}. Executing ${job.getSteps().length} steps.`);
      for (const step of job.getSteps()) {
        const stepResult = step.getStatus() as ZArtifactDeployResultType;
        const commandConf = step.getCommandConfig();
        this.log(`${commandConf.displayMessage!}`);
        if (stepResult.status === DeployStatus.Enum.Resolved) {
          // eslint-disable-next-line no-await-in-loop
          await OclifUtils.wrapCoreCommand(commandConf, this.config);
          // looks like this continues, instead of aborting with error
          stepResult.status = DeployStatus.Enum.Success;
        }
        jobResults.push(stepResult);
      }
      // TODO need to find smart way to reduce all status of all steps
      this.log(`Completed ${job.name} with ${job.getSteps()[0].getStatus().status!}`);
      result[job.name] = jobResults;
    }
    return result;
  }
}
