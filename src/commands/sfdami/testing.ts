/* eslint-disable no-await-in-loop */
/* eslint-disable sf-plugin/no-hardcoded-messages-flags */

// import { EventEmitter } from 'node:events';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Config } from '@oclif/core';
import SubclassTesting, { ProcessingStatus, PlanObjectEvent } from '../../common/utils/subclassTesting.js';
import { eventBus } from '../../common/comms/eventBus.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sfdami', 'testing');

export type TestingResult = {
  path: string;
};

export default class Testing extends SfCommand<TestingResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    iterations: Flags.integer({
      summary: 'How many times to execute?',
      char: 'i',
      required: true,
    }),
  };

  public constructor(argv: string[], config: Config) {
    // Call the parent constructor with the required arguments
    super(argv, config);
    eventBus.on('planObjectEvent', (payload: PlanObjectEvent) => this.handlePlanEvents(payload));
  }

  public async run(): Promise<TestingResult> {
    const { flags } = await this.parse(Testing);
    const objects: string[] = ['Account', 'Contact', 'Order', 'Asset', 'Site__c'];
    for (const name of objects) {
      await SubclassTesting.simulateObjectExecution(flags.iterations, name);
    }
    return {
      path: 'src/commands/testing.ts',
    };
  }

  private handlePlanEvents(payload: PlanObjectEvent): void {
    if (payload.status === ProcessingStatus.Started) {
      this.spinner.start(`Exporting ${payload.objectName}`, 'Status msg');
    }
    if (payload.status === ProcessingStatus.InProgress) {
      this.spinner.status = `Completed ${payload.batchesCompleted} of ${payload.totalBatches} batches`;
    }
    if (payload.status === ProcessingStatus.Completed) {
      this.spinner.stop(`Completed ${payload.objectName} successfully!`);
    }
  }
}
