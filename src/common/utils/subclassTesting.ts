import { eventBus } from '../comms/eventBus.js';

export default class SubclassTesting {
  // Emit the custom event with a message
  public static async sleepAndLog(iteration: number, sleepTime: number): Promise<void> {
    eventBus.emit('customEvent', 'Hello from the custom event!');
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, sleepTime);
    });
  }
}
