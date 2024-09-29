/* eslint-disable no-await-in-loop */
/* eslint-disable sf-plugin/no-hardcoded-messages-flags */

// import { EventEmitter } from 'node:events';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import SubclassTesting from '../../common/utils/subclassTesting.js';
import { eventBus } from '../../common/comms/eventBus.js';
import { Config } from '@oclif/core';

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
    eventBus.on('customEvent', (message: string) => this.handleExportEvents(message));
  }

  public async run(): Promise<TestingResult> {
    const { flags } = await this.parse(Testing);
    for (let i = 0; i < flags.iterations; i++) {
      console.log(`Calling subclass in iteration: ${i}`);
      await SubclassTesting.sleepAndLog(i, 1000);
    }
    return {
      path: 'src/commands/testing.ts',
    };
  }

  private handleExportEvents(message: string): void {
    console.log(`Handling event: ${message}`);
    this.log(`Received event: ${message}`);
  }

  // private runIt(iteration: number, sleepTime: number): Promise<void> {
  //   this.log(`Sleeping in ${iteration}. Iteration.`);
  //   return new Promise<void>((resolve) => {
  //     setTimeout(() => {
  //       resolve();
  //     }, sleepTime);
  //   });
  // }
}
