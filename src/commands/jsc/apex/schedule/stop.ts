import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexScheduleService from '../../../../common/apex-scheduler/apexScheduleService.js';
import { CommandStatusEvent } from '../../../../common/comms/processingEvents.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.apex.schedule.stop');

export type JscApexScheduleStopResult = {
  jobId: string;
  status: string;
};

export default class JscApexScheduleStop extends SfCommand<JscApexScheduleStopResult[]> {
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
      description: messages.getMessage('flags.apex-class-name.description'),
    }),
    id: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.id.summary'),
      description: messages.getMessage('flags.id.description'),
    }),
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
    }),
    trace: Flags.boolean({
      summary: messages.getMessage('flags.trace.summary'),
      description: messages.getMessage('flags.trace.description'),
    }),
  };

  public async run(): Promise<JscApexScheduleStopResult[]> {
    const { flags } = await this.parse(JscApexScheduleStop);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    if (flags.trace) {
      scheduleService.on('logOutput', (payload: CommandStatusEvent) => {
        this.info(payload.message ?? 'No logs received. Nothing to trace.');
      });
      scheduleService.on('diagnostics', (payload: CommandStatusEvent) => {
        this.info(payload.message ?? 'No diagnostics received. Nothing to trace.');
      });
    }
    const ids = flags['id'] !== undefined ? [flags['id']] : [];
    const result = await scheduleService.stopJobs({
      ids,
    });
    this.logSuccess(messages.getMessage('info.success', [flags['id']]));
    return result;
  }
}
