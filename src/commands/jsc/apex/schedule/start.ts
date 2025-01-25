import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexScheduleService from '../../../../common/apex-scheduler/apexScheduleService.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.apex.schedule.start');

export type JscApexScheduleStartResult = {
  jobId: string;
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
      char: 'n',
      summary: messages.getMessage('flags.apex-class-name.summary'),
      description: messages.getMessage('flags.apex-class-name.description'),
    }),
  };

  public async run(): Promise<JscApexScheduleStartResult> {
    const { flags } = await this.parse(JscApexScheduleStart);
    const scheduleService = new ApexScheduleService(flags['target-org'].getConnection('62.0'));
    return scheduleService.scheduleJob({ apexClassName: flags['apex-class-name'], cronExpression: '0 0 0 ? * * * *' });
  }
}
