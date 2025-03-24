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
  };

  public async run(): Promise<ManageJobsResult> {
    const { flags } = await this.parse(JscApexScheduleManage);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    const yamlContent = yaml.load(fs.readFileSync(flags['config-file'], 'utf8'));
    const jobConfig = ScheduledJobConfig.parse(yamlContent);
    const result = await scheduleService.manageJobs(jobConfig);
    this.printStartedJobs(result.started);
    this.printStoppedJobs(result.stopped);
    this.printUntouchedJobs(result.untouched);
    return result;
  }

  private printStartedJobs(startedJobs: ScheduleApexResult[]): void {
    if (startedJobs.length > 0) {
      this.table({
        data: startedJobs,
        title: StandardColors.success(`${startedJobs.length} Jobs Successfully Started`),
      });
    }
  }

  private printStoppedJobs(stoppedJobs: AsyncApexJobFlat[]): void {
    if (stoppedJobs.length > 0) {
      this.table({
        columns: [
          { key: 'ApexClassName' },
          { key: 'CronJobDetailName' },
          { key: 'TimesTriggered' },
          { key: 'CronExpression' },
        ],
        data: stoppedJobs,
        title: StandardColors.error(`${stoppedJobs.length} Jobs Successfully Stopped`),
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
