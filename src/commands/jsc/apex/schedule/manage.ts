import fs from 'node:fs';
import yaml from 'js-yaml';
import ansis from 'ansis';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexScheduleService, { ManageJobsResult } from '../../../../common/apex-scheduler/apexScheduleService.js';
import { AsyncApexJobFlat, ScheduledJobConfig } from '../../../../types/scheduledApexTypes.js';
import { ScheduleApexResult } from '../../../../common/apex-scheduler/scheduleSingleJobTask.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.apex.schedule.manage');

export default class JscApexScheduleManage extends SfCommand<ManageJobsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
    'config-file': Flags.string({
      required: true,
      char: 'f',
      summary: messages.getMessage('flags.config-file.summary'),
      description: messages.getMessage('flags.config-file.description'),
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      description: messages.getMessage('flags.dry-run.description'),
    }),
  };

  public async run(): Promise<ManageJobsResult> {
    const { flags } = await this.parse(JscApexScheduleManage);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    const yamlContent = yaml.load(fs.readFileSync(flags['config-file'], 'utf8'));
    const jobConfig = ScheduledJobConfig.parse(yamlContent);
    if (flags['dry-run']) {
      this.info(messages.getMessage('infos.dry-run-mode'));
      this.info(messages.getMessage('infos.dry-run-cannot-compile'));
      this.info('\n');
    }
    const result = await scheduleService.manageJobs(jobConfig, flags['dry-run']);
    this.printStartedJobs(result.started, flags['dry-run']);
    this.printStoppedJobs(result.stopped, flags['dry-run']);
    this.printUntouchedJobs(result.untouched);
    return result;
  }

  private printStartedJobs(startedJobs: Array<Partial<ScheduleApexResult>>, dryRun: boolean): void {
    const title = dryRun
      ? `${startedJobs.length} Jobs Will Be Started`
      : `${startedJobs.length} Jobs Successfully Started`;
    if (startedJobs.length > 0) {
      this.table({
        data: startedJobs,
        title: StandardColors.success(title),
      });
    }
  }

  private printStoppedJobs(stoppedJobs: AsyncApexJobFlat[], dryRun: boolean): void {
    const title = dryRun
      ? `${stoppedJobs.length} Jobs Will Be Stopped`
      : `${stoppedJobs.length} Jobs Successfully Stopped`;
    if (stoppedJobs.length > 0) {
      this.table({
        columns: [
          { key: 'ApexClassName' },
          { key: 'CronJobDetailName' },
          { key: 'TimesTriggered' },
          { key: 'CronExpression' },
        ],
        data: stoppedJobs,
        title: StandardColors.error(title),
      });
    }
  }

  private printUntouchedJobs(untouchedJobs: AsyncApexJobFlat[]): void {
    if (untouchedJobs.length > 0) {
      this.table({
        data: untouchedJobs,
        title: ansis.blue.bold(`${untouchedJobs.length} Existing Jobs Unchanged`),
      });
    }
  }
}
