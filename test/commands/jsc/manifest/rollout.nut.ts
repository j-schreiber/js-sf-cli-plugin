import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JscManifestRolloutResult } from '../../../../src/commands/jsc/manifest/rollout.js';
import { DeployStatus } from '../../../../src/types/orgManifestGlobalConstants.js';

const scratchOrgAlias = 'TestTargetOrg';
const devhubUsername = process.env.TESTKIT_HUB_USERNAME;

describe('jsc manifest rollout NUTs*', () => {
  let session: TestSession;
  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'manifestRolloutProject',
        sourceDir: path.join('test', 'data', 'test-sfdx-project'),
      },
      devhubAuthStrategy: 'AUTH_URL',
      scratchOrgs: [
        {
          alias: scratchOrgAlias,
          config: path.join('config', 'default-scratch-def.json'),
          setDefault: false,
          duration: 1,
        },
      ],
    });
  });

  after(async () => {
    await session?.clean();
  });

  describe('rollout simple manifest', () => {
    it('should successfully roll out the valid manifest with packaged and unpackaged artifacts', () => {
      const result = execCmd<JscManifestRolloutResult>(
        `jsc:manifest:rollout --manifest manifest.yml --target-org ${scratchOrgAlias} --devhub-org ${session.hubOrg.username} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      // console.log(result);
      expect(result).to.not.be.undefined;
      expect(result!.status).to.equal(0);
      const scratchOrgUsername = session.orgs.get(scratchOrgAlias)?.username;
      expect(result!.result.targetOrgUsername).to.equal(scratchOrgUsername);
      expect(result!.result.devhubOrgUsername).to.equal(devhubUsername);
      expect(result!.result.deployedArtifacts['apex_utils']).to.not.be.undefined;
      expect(result!.result.deployedArtifacts['apex_utils'][0].status).to.equal(DeployStatus.Enum.Success);
      expect(result!.result.deployedArtifacts['unpackaged']).to.not.be.undefined;
      expect(result!.result.deployedArtifacts['unpackaged'][0].status).to.equal(DeployStatus.Enum.Success);
    });
  });
});
