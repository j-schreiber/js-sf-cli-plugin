import util from 'node:util';
import childProcess from 'node:child_process';
import { Config } from '@oclif/core';
import { SfCommandConfig } from '../../release-manifest/artifact-deploy-strategies/artifactDeployStrategy.js';

const exec = util.promisify(childProcess.exec);
const spawn = util.promisify(childProcess.spawn);

export default class OclifUtils {
  public static async wrapCoreCommand(conf: SfCommandConfig, oclifConfig: Config): Promise<OflicCommandResult> {
    const cmdOutput = await oclifConfig.runCommand(conf.name!, [...conf.args, '--json']);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(cmdOutput));
    return cmdOutput as OflicCommandResult;
  }

  public static async wrapCoreCommandAsChildProcess(conf: SfCommandConfig): Promise<OflicCommandResult> {
    const commandName = `sf ${conf.name!.split(':').join(' ')}`;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await spawn(commandName, [...conf.args, '--json'], { shell: true });
      return { status: 0, result: 'placeholder' };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(e));
      return { status: 1, result: e };
    }
    // return { status: cmdOutput.status, result: JSON.parse(cmdOutput.stdout.toString()) };
  }

  public static async execCoreCommand(conf: SfCommandConfig): Promise<OflicCommandResult> {
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

export type OflicCommandResult = {
  status: number | null;
  result: unknown;
};
