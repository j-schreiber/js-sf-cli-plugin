import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexScheduleService from '../../../../common/apex-scheduler/apexScheduleService.js';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.apex.schedule.start');

export type JscApexScheduleStartResult = {
  jobId: string;
  nextFireTime: Date;
};

export default class JscApexScheduleStart extends SfCommand<JscApexScheduleStartResult> {
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
      required: true,
      char: 'c',
      summary: messages.getMessage('flags.apex-class-name.summary'),
      description: messages.getMessage('flags.apex-class-name.description'),
    }),
    'cron-expression': Flags.string({
      required: true,
      char: 'e',
      summary: messages.getMessage('flags.cron-expression.summary'),
      description: messages.getMessage('flags.cron-expression.description'),
    }),
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
    }),
    trace: Flags.boolean({
      summary: messages.getMessage('flags.trace.summary'),
      description: messages.getMessage('flags.trace.description'),
    }),
  };

  public async run(): Promise<JscApexScheduleStartResult> {
    const { flags } = await this.parse(JscApexScheduleStart);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    if (flags.trace) {
      scheduleService.on('logOutput', (payload: CommandStatusEvent) => {
        this.info(payload.message ?? 'No logs received. Nothing to trace.');
      });
      scheduleService.on('diagnostics', (payload: CommandStatusEvent) => {
        this.info(payload.message ?? 'No diagnostics received. Nothing to trace.');
      });
    }
    const result = await scheduleService.scheduleJob({
      apexClassName: flags['apex-class-name'],
      cronExpression: flags['cron-expression'],
      jobName: flags.name,
    });
    this.logSuccess(messages.getMessage('info.success', [result.jobId, result.nextFireTime.toUTCString()]));
    return result;
  }
}
