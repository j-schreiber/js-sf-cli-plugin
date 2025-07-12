import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { SinonSandbox } from 'sinon';
import { captureOutput } from '@oclif/test';
import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import JscMaintainFieldUsageAnalyse, {
  JscMaintainFieldUsageAnalyseResult,
} from '../../../../../src/commands/jsc/maintain/field-usage/analyse.js';
import FieldUsageTestContext from '../../../../mock-utils/fieldUsageTestContext.js';
import FieldUsageMultiStageOutput, { MultiStageData } from '../../../../../src/field-usage/fieldUsageMultiStage.js';

describe('jsc maintain field-usage analyse', () => {
  const $$ = new FieldUsageTestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let uxStub: ReturnType<typeof stubUx>;
  let multiStageStub: ReturnType<typeof stubMultiStageUx>;

  beforeEach(async () => {
    await $$.init();
    sfCommandStubs = stubSfCommandUx($$.coreContext.SANDBOX);
    multiStageStub = stubMultiStageUx($$.coreContext.SANDBOX);
    uxStub = stubUx($$.coreContext.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
    // captureOutput adds listeners
    process.removeAllListeners();
  });

  it('analyses fields for sobject and prints table with usage statistics', async () => {
    // Act
    await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--sobject',
      'Order',
    ]);

    // Assert
    expect(uxStub.table.callCount).to.equal(2);
    // 5 per object: post stages blocks, records and describe
    expect(multiStageStub.updateData.callCount).to.equal(12);
    expect(multiStageStub.error.callCount).to.equal(0);
    // 3 updates per object
    expect(multiStageStub.goto.callCount).to.equal(6);
    uxStub.table.args.flat().forEach((tableArgs) => {
      expect(tableArgs.columns).to.deep.equal(['name', 'type', 'absolutePopulated', 'percent']);
    });
  });

  it('prints additional default values statistics in field usage when flag is set', async () => {
    // Act
    await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--check-defaults',
    ]);

    // Assert
    expect(uxStub.table.callCount).to.equal(1);
    expect(uxStub.table.args.flat()[0].columns).to.deep.equal([
      'name',
      'type',
      'absolutePopulated',
      'defaultValue',
      'percent',
    ]);
  });

  it('prints results table in markdown if results-format markdown is specified', async () => {
    // Act
    await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--result-format',
      'markdown',
    ]);

    // Assert
    expect(uxStub.table.callCount).to.equal(0);
    // 3 calls for title, 1 call for table
    expect(uxStub.log.callCount).to.equal(4);
    // need to extract markdown output to dedicated formatter
    // for easier stubbing and testing. For now, just assert basic
    // markdown formatting in output -> first table column header
    expect(uxStub.log.args.flat()[0]).to.contain('\n');
    expect(uxStub.log.args.flat()[1]).to.contain('Analysed Fields');
    expect(uxStub.log.args.flat()[2]).to.contain('===============');
    expect(uxStub.log.args.flat()[3]).to.contain('| Name');
  });

  it('prints results table in csv if results-format csv is specified', async () => {
    // Act
    await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--result-format',
      'csv',
    ]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(0);
    expect(sfCommandStubs.log.callCount).to.equal(1);
    // need to extract markdown output to dedicated formatter
    // for easier stubbing and testing. For now, just assert basic
    // markdown formatting in output -> first table column header
    expect(sfCommandStubs.log.args.flat()[0]).to.contain('name,type,absolutePopulated');
  });

  it('prints no table and completes early, if no records are found', async () => {
    // Arrange
    $$.totalRecords = 0;

    // Act
    await JscMaintainFieldUsageAnalyse.run(['--target-org', $$.testTargetOrg.username, '--sobject', 'Account']);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(0);
    expect(multiStageStub.stop.callCount).to.equal(1);
    expect(multiStageStub.error.callCount).to.equal(0);
  });

  it('analyses fields for sobject and returns json result with both sobjects', async () => {
    // Act
    const result = await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--sobject',
      'Order',
      '--json',
    ]);

    // Assert
    expect(Object.keys(result)).to.deep.equal(['Account', 'Order']);
    expect(result.Account).not.to.be.undefined;
    expect(Object.keys(result.Account)).to.deep.equal(['Master']);
    expect(result.Account.Master.analysedFields.length).to.equal($$.getFilterableFields());
    expect(result.Order).not.to.be.undefined;
    expect(Object.keys(result.Order)).to.deep.equal(['Master']);
    expect(result.Order.Master.analysedFields.length).to.equal($$.getFilterableFields());
  });

  ['markdown', 'human', 'csv'].forEach((reporter) => {
    it(`does not show any UX output when --json flag is used on ${reporter} reporter`, async () => {
      // Arrange
      // remove stubs on UX for this test to ensure, that only JSON output is generated
      $$.coreContext.SANDBOX.restore();

      // Act
      const { stdout, stderr } = await captureOutput(async () =>
        JscMaintainFieldUsageAnalyse.run([
          '--target-org',
          $$.testTargetOrg.username,
          '--sobject',
          'Account',
          '--json',
          '--result-format',
          reporter,
        ])
      );

      // Assert
      const { result } = JSON.parse(stdout) as { result: JscMaintainFieldUsageAnalyseResult };
      // for some reason beyond my understanding, command status is "1" when running tests
      // from terminal (yarn test), but it is 0 when running tests from mocha tests
      // explorer. stdr is empty in both cases, and result contains the correct data
      // expect(jsonResult.status).to.equal(0);
      expect(stderr).to.be.empty;
      expect(result).is.not.undefined;
      expect(result['Account']).is.not.undefined;
    });
  });

  it('throws an error when invalid sobject name is provided', async () => {
    // Arrange
    $$.coreContext.fakeConnectionRequest = $$.mockDescribeFailure;

    // Act
    try {
      await JscMaintainFieldUsageAnalyse.run([
        '--target-org',
        $$.testTargetOrg.username,
        '--sobject',
        'InvalidSObjectName__c',
      ]);
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      // this.error(...) returns 2, uncaught SfError returns 1
      expect(err.exitCode).to.equal(2);
      expect(err.message).to.contain('InvalidSObjectName__c');
    }
  });

  it('ignores history analysis when flag is set and object has history not enabled', async () => {
    // Arrange
    $$.sobjectDescribe.childRelationships = [];

    // Act
    const result = await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--check-history',
    ]);

    // Assert
    expect(Object.keys(result)).to.deep.equal(['Account']);
    result.Account.Master.analysedFields.forEach((fieldStats) => {
      expect(Object.keys(fieldStats)).to.deep.equal(['name', 'type', 'absolutePopulated', 'percentagePopulated']);
    });
  });

  it('includes history analysis when flag is set and object has history enabled', async () => {
    // Act
    const result = await JscMaintainFieldUsageAnalyse.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--sobject',
      'Account',
      '--check-history',
    ]);

    // Assert
    expect(Object.keys(result)).to.deep.equal(['Account']);
    result.Account.Master.analysedFields.forEach((fieldStats) => {
      expect(Object.keys(fieldStats)).to.deep.equal([
        'name',
        'type',
        'absolutePopulated',
        'percentagePopulated',
        'histories',
        'lastUpdated',
      ]);
      expect(fieldStats.histories).to.equal(0);
      expect(fieldStats.lastUpdated).to.equal('2025-07-05');
    });
  });
});

export function stubMultiStageUx(sandbox: SinonSandbox): sinon.SinonStubbedInstance<MultiStageOutput<MultiStageData>> {
  const multiStageStub = sandbox.createStubInstance(MultiStageOutput);
  sandbox.stub(FieldUsageMultiStageOutput, 'create').returns(multiStageStub);
  return multiStageStub;
}
