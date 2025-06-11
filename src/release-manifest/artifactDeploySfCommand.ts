import { SfCommandConfig } from '../common/utils/sfCommandConfig.js';

export default class ArtifactDeploySfCommand {
  /**
   * Colon-separated oclif identifier, e.g. project:deploy:start or package:install
   */
  public oclifIdentifier: string;

  /**
   * All parsed flags that will be applied when config is build. Flags are
   * unique by their identifier.
   */
  public commandFlags: Map<string, string | undefined>;

  public constructor(oclifIdentifier: string, flags?: SfCommandFlag[]) {
    this.oclifIdentifier = oclifIdentifier;
    this.commandFlags = new Map();
    if (flags) {
      flags.forEach((conf) => {
        this.commandFlags.set(conf.name, conf.value);
      });
    }
  }

  /**
   * Parses unstructured string input to internal flags dictionary. All
   * values are written into the internal state.
   *
   * @param flagsInput
   */
  public parseFlags(flagsInput?: string): void {
    if (!flagsInput || flagsInput.length === 0) {
      return;
    }
    flagsInput
      .trim()
      .split(/\s+/)
      .forEach((flagIdentifier) => {
        const flagKeyValue = flagIdentifier.replace(/^-+/, '').split('=');
        if (flagKeyValue[0].length > 1) {
          this.commandFlags.set(flagKeyValue[0], flagKeyValue[1]);
        }
      });
  }

  /**
   * Adds a flag config to the internal flags dictionary.
   *
   * @param identifier
   * @param value
   */
  public addFlag(identifier: string, value?: string): void {
    if (identifier.length === 0) {
      throw Error('Flag identifier cannot be empty');
    }
    this.commandFlags.set(identifier, value);
  }

  /**
   * Builds the command arguments that can be used to execute
   */
  public buildConfig(): SfCommandConfig {
    const args = [];
    for (const [key, value] of this.commandFlags.entries()) {
      args.push(`--${key}`);
      if (value) {
        args.push(`${value}`);
      }
    }
    return {
      name: this.oclifIdentifier,
      args,
    };
  }
}

export type SfCommandFlag = {
  name: string;
  value?: string;
};
