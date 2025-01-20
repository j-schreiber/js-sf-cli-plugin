import fs from 'node:fs';
import Sinon from 'sinon';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import JscDataExport from '../../../../src/commands/jsc/data/export.js';
import { LOCAL_CACHE_DIR } from '../../../../src/common/constants.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';
import { mockAnySObjectDescribe } from '../../../mock-utils/sfQueryApiMocks.js';
import { pathHasNoFiles } from '../../../../src/common/utils/fileUtils.js';

const TEST_PATH = 'exports/export-test-ts';

describe('jsc plan export', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    testOrg.orgId = '00Dxx0000000000AAA';
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.SANDBOX);
    $$.fakeConnectionRequest = mockAnySObjectDescribe;
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    $$.restore();
    // cached describes
    fs.rmSync(`./${LOCAL_CACHE_DIR}/${testOrg.username}`, { recursive: true, force: true });
    // file exports with explicit path
    fs.rmSync(TEST_PATH, { recursive: true, force: true });
    // default export
    fs.rmSync('exports', { recursive: true, force: true });
  });

  it('runs command with required params => exits OK', async () => {
    // Act
    const result = await JscDataExport.run([
      '--source-org',
      testOrg.username,
      '--plan',
      'test/data/plans/test-plan.yaml',
      '--output-dir',
      TEST_PATH,
    ]);

    // Assert
    expect(result).to.be.ok;
    // only there so the stupid linter does not complain
    // until I figured out how to assert on that thing
    // sfCommandStubs.log returns each call to this.log(...) as array
    expect(sfCommandStubs).to.be.ok;
    // started/stopped once for validation, and per each object (4)
    Sinon.assert.callCount(sfSpinnerStub.start, 5);
    Sinon.assert.callCount(sfSpinnerStub.stop, 5);
    expect(result.sourceOrgId).equals(testOrg.orgId);
  });

  it('runs command with --json and valid plan => has query details in result', async () => {
    // Act
    const result = await JscDataExport.run([
      '--source-org',
      testOrg.username,
      '--plan',
      'test/data/plans/test-plan.yaml',
      '--output-dir',
      TEST_PATH,
      '--json',
    ]);

    // Assert
    expect(result.sourceOrgId).equals(testOrg.orgId);
    expect(result.exports).to.not.be.undefined;
    expect(result.exports.length).equals(4);
    expect(result.exports[0].queryString).equals('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
    expect(result.exports[1].queryString).equals(
      'SELECT Id,Name,AccountId FROM Contact WHERE AccountId IN :myAccountIds AND AccountId != NULL'
    );
    expect(result.exports[2].queryString).equals('SELECT Id,AccountId,BillToContactId FROM Order LIMIT 100');
    expect(result.exports[3].queryString).equals('SELECT Id,AccountId FROM Opportunity LIMIT 10');
    result.exports.forEach((exportObject) => {
      expect(exportObject.isSuccess).to.equal(true, 'isSuccess of: ' + JSON.stringify(exportObject));
      expect(exportObject.files.length).to.equal(0, 'files.length of: ' + JSON.stringify(exportObject));
      expect(exportObject.totalSize).to.equal(0, 'totalSize of: ' + JSON.stringify(exportObject));
    });
  });

  it('runs command with invalid plan file => exits error', async () => {
    // Act
    try {
      await JscDataExport.run([
        '--source-org',
        testOrg.username,
        '--plan',
        'test/data/plans/invalid-plan.yaml',
        '--output-dir',
        TEST_PATH,
      ]);
      // shouldThrow appears to throw an SfError
      expect.fail('Should throw exception');
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      // haven't figured out yet, what determins the exit code
      // 1 appears to be sub-level errors, 2 is explicit SfCommand-level errors?
      expect(err.exitCode).to.equal(1);
    }
    Sinon.assert.callCount(sfSpinnerStub.start, 1);
    Sinon.assert.callCount(sfSpinnerStub.stop, 1);
  });

  it('runs with --validate-only flag and returns object array in --json output', async () => {
    // Act
    const result = await JscDataExport.run([
      '--source-org',
      testOrg.username,
      '--plan',
      'test/data/test-sfdx-project/export-plans/plan-for-empty-bind.yml',
      '--output-dir',
      TEST_PATH,
      '--json',
      '--validate-only',
    ]);

    // Assert
    expect(pathHasNoFiles(TEST_PATH)).to.be.true;
    expect(result.exports.length).to.equal(3);
    result.exports.forEach((objectResult, index) => {
      expect(objectResult.isSuccess).to.equal(false, `index ${index} is success`);
      expect(objectResult.totalSize).to.equal(0, `index ${index} total size`);
      expect(objectResult.files.length).to.equal(0, `index ${index} files length`);
      expect(objectResult.executedFullQueryStrings.length).to.equal(0, `index ${index} queries executed`);
    });
    expect(result.exports[0].queryString).to.equal('SELECT Id FROM User LIMIT 0');
    expect(result.exports[1].queryString).to.equal(
      'SELECT Id FROM Account WHERE OwnerId IN :emptyOwnerIds AND OwnerId != NULL'
    );
    expect(result.exports[2].queryString).to.equal(
      'SELECT Id FROM Contact WHERE AccountId IN :emptyAccountIds AND AccountId != NULL'
    );
  });
});
