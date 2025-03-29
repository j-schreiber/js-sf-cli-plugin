import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexScheduleService from '../../../../common/apex-scheduler/apexScheduleService.js';
import { AsyncApexJobFlat, ScheduledJobConfigType } from '../../../../types/scheduledApexTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.apex.schedule.export');
const DEFAULT_EXPORT_FILE_NAME = 'jobs.yaml';

export default class JscApexScheduleExport extends SfCommand<AsyncApexJobFlat[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
    'apex-class-name': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.apex-class-name.summary'),
    }),
    'job-name': Flags.string({
      char: 'j',
      summary: messages.getMessage('flags.job-name.summary'),
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      char: 'd',
    }),
    concise: Flags.boolean({
      summary: messages.getMessage('flags.concise.summary'),
    }),
  };

  public async run(): Promise<AsyncApexJobFlat[]> {
    const { flags } = await this.parse(JscApexScheduleExport);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    const jobs = await scheduleService.findJobs({
      apexClassName: flags['apex-class-name'],
      jobName: flags['job-name'],
    });
    this.table({
      data: jobs,
      columns: flags.concise
        ? [{ key: 'CronTriggerId' }, { key: 'ApexClassName' }, { key: 'TimesTriggered' }]
        : undefined,
    });
    this.writeResults(jobs, flags['output-dir']);
    return jobs;
  }

  private writeResults(data: AsyncApexJobFlat[], filePath?: string): void {
    if (!filePath) {
      return;
    }
    const outputPath = path.join(filePath, DEFAULT_EXPORT_FILE_NAME);
    // eslint-disable-next-line camelcase
    const jobsConfig: ScheduledJobConfigType = { options: { stop_other_jobs: false }, jobs: {} };
    data.forEach(
      (apexJob) =>
        (jobsConfig.jobs[apexJob.CronJobDetailName] = {
          class: apexJob.ApexClassName,
          expression: apexJob.CronExpression!,
        })
    );
    const fileContent = yaml.dump(jobsConfig);
    fs.mkdirSync(filePath, { recursive: true });
    fs.writeFileSync(outputPath, fileContent);
    this.info(messages.getMessage('info.wrote-output-to-file', [outputPath]));
  }
}
