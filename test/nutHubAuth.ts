import { execFileSync } from 'node:child_process';

/**
 * Loaded with `--require` by all NUT scripts, before any `TestSession` is created.
 *
 * Works around the "REUSE" devhub strategy of `@salesforce/cli-plugins-testkit` (5.3.x).
 * When only `TESTKIT_HUB_USERNAME` is set, the testkit parses the output of
 * `sf org display --verbose --json` without stripping ANSI colors. When the parent
 * process forces colors (`FORCE_COLOR`, e.g. set by wireit in a TTY), oclif colorizes
 * the JSON and `JSON.parse` fails. Also, the sf CLI redacts `sfdxAuthUrl` unless
 * `SF_TEMP_SHOW_SECRETS` is set.
 *
 * We resolve the auth url ourselves (without colors and redaction, only for this
 * one call) and hand it to the testkit as `TESTKIT_AUTH_URL`. Colors of the test
 * run are not affected. Does nothing, if an auth url or JWT credentials are provided.
 */
const devhub = process.env.TESTKIT_HUB_USERNAME;
if (devhub && !process.env.TESTKIT_AUTH_URL && !process.env.TESTKIT_JWT_KEY) {
  const output = execFileSync('sf', ['org', 'display', '--target-org', devhub, '--verbose', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', SF_TEMP_SHOW_SECRETS: 'true' },
  });
  const authUrl = (JSON.parse(output) as { result?: { sfdxAuthUrl?: string } }).result?.sfdxAuthUrl;
  if (!authUrl?.startsWith('force://')) {
    throw new Error(`Could not resolve an SFDX auth url for TESTKIT_HUB_USERNAME=${devhub}`);
  }
  process.env.TESTKIT_AUTH_URL = authUrl;
}
