import { Config } from '@oclif/core';
import { SfCommandConfig } from '../../release-manifest/artifact-deploy-strategies/artifactDeployStrategy.js';

export default class OclifUtils {
  public static async wrapCoreCommand(conf: SfCommandConfig, oclifConfig: Config): Promise<void> {
    await oclifConfig.runCommand(conf.name!, conf.args);
  }
}
