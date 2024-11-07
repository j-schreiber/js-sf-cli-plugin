import util from 'node:util';
import childProcess from 'node:child_process';
import { SfCommandConfig } from '../../release-manifest/artifact-deploy-strategies/artifactDeployStrategy.js';

const exec = util.promisify(childProcess.exec);

export default class OclifUtils {
  public static async execCoreCommand(conf: SfCommandConfig): Promise<CommandResult> {
    const commandName = `sf ${conf.name!.split(':').join(' ')} ${[...conf.args, '--json'].join(' ')}`;
    try {
      // could use stdout and stderr callbacks to bubble events
      // up to the parent command for display
      const cmdOutput = await exec(commandName);
      return { status: 0, result: JSON.parse(cmdOutput.stdout) };
    } catch (e) {
      if (e instanceof Error && 'stdout' in e) {
        return { status: 1, result: JSON.parse(e.stdout as string) };
      } else {
        return { status: 1, result: e };
      }
    }
  }
}

export type CommandResult = {
  status: number | null;
  result: unknown;
};
