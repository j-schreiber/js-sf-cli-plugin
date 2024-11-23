import fs from 'node:fs';
import Sinon from 'sinon';
import { type AnyJson } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import JscDataExport from '../../../../src/commands/jsc/data/export.js';
import { MockAnyObjectResult } from '../../../data/describes/mockDescribeResults.js';
import { GenericSuccess } from '../../../data/api/queryResults.js';
import { LOCAL_CACHE_DIR } from '../../../../src/common/constants.js';
import { eventBus } from '../../../../src/common/comms/eventBus.js';

const TEST_PATH = 'exports/export-test-ts';

describe('jsc plan export', () => {
  const $$ = new TestContext();
  let testOrg = new MockTestOrgData();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let sfSpinnerStub: ReturnType<typeof stubSpinner>;

  beforeEach(() => {
    testOrg = new MockTestOrgData();
    testOrg.orgId = '00Dxx0000000000AAA';
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    sfSpinnerStub = stubSpinner($$.SANDBOX);
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
    // Arrange
    await $$.stubAuths(testOrg);
    mockDescribeCalls();

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
    expect(result['source-org-id']).equals(testOrg.orgId);
  });

  it('runs command with --json and valid plan => has query details in result', async () => {
    // Arrange
    await $$.stubAuths(testOrg);
    mockDescribeCalls();

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
    expect(result['source-org-id']).equals(testOrg.orgId);
    expect(result.exports).to.not.be.undefined;
    expect(result.exports?.length).equals(4);
    expect(result.exports![0].queryString).equals('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
    // we have mocked describe calls, that's why contact is resolved to AnyObject
    expect(result.exports![1].queryString).equals(
      "SELECT Id,Name FROM AnyObject WHERE AccountId IN ('') AND AccountId != NULL"
    );
    expect(result.exports![2].queryString).equals('SELECT Id,AccountId,BillToContactId FROM Order LIMIT 100');
    expect(result.exports![3].queryString).equals('SELECT Id,AccountId FROM Opportunity LIMIT 10');
  });

  it('runs command with invalid plan file => exits error', async () => {
    // Arrange
    await $$.stubAuths(testOrg);

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

  function mockDescribeCalls() {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      if (request?.toString().endsWith('/describe')) {
        return Promise.resolve(MockAnyObjectResult as AnyJson);
      }
      return Promise.resolve(GenericSuccess);
    };
  }
});
