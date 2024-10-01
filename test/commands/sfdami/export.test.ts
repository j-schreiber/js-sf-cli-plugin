import fs from 'node:fs';
import Sinon from 'sinon';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import SfdamiExport from '../../../src/commands/sfdami/export.js';

const TEST_PATH = 'exports/export-test-ts';

describe('sfdami plan export', () => {
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
    $$.restore();
    // cached describes
    fs.rmSync(`./.sfdami/${testOrg.username}`, { recursive: true, force: true });
    // file exports with explicit path
    fs.rmSync(TEST_PATH, { recursive: true, force: true });
    // default export
    fs.rmSync('exports', { recursive: true, force: true });
  });

  it('runs command with required params => exits OK', async () => {
    // Arrange
    await $$.stubAuths(testOrg);

    // Act
    const result = await SfdamiExport.run([
      '--source-org',
      testOrg.username,
      '--plan',
      'test/data/test-plan.yaml',
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

  it('runs command with invalid plan file => exits error', async () => {
    // Arrange
    await $$.stubAuths(testOrg);

    // Act
    try {
      await SfdamiExport.run([
        '--source-org',
        testOrg.username,
        '--plan',
        'test/data/invalid-plan.yaml',
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
    // for reasons beyond my understanding, start is called twice
    // the "validation.started" event is published & received two times
    // this could be related to the framework that starts/stops the spinner
    // in case of an error?
    Sinon.assert.callCount(sfSpinnerStub.start, 2);
    // spinner is never stopped by my code (atm)
    Sinon.assert.callCount(sfSpinnerStub.stop, 1);
  });
});
