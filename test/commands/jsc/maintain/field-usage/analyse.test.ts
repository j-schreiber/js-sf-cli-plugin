import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { SinonSandbox } from 'sinon';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import JscMaintainFieldUsageAnalyse from '../../../../../src/commands/jsc/maintain/field-usage/analyse.js';
import FieldUsageTestContext from '../../../../mock-utils/fieldUsageTestContext.js';
import FieldUsageMultiStageOutput, { MultiStageData } from '../../../../../src/field-usage/fieldUsageMultiStage.js';

describe('jsc maintain field-usage analyse', () => {
  const $$ = new FieldUsageTestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  let multiStageStub: ReturnType<typeof stubMultiStageUx>;

  beforeEach(async () => {
    await $$.init();
    sfCommandStubs = stubSfCommandUx($$.coreContext.SANDBOX);
    multiStageStub = stubMultiStageUx($$.coreContext.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
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
    expect(sfCommandStubs.table.callCount).to.equal(2);
    // 3 per object: records and describe
    expect(multiStageStub.updateData.callCount).to.equal(6);
    expect(multiStageStub.error.callCount).to.equal(0);
    // 3 updates per object
    expect(multiStageStub.goto.callCount).to.equal(6);
    sfCommandStubs.table.args.flat().forEach((tableArgs) => {
      expect(tableArgs.columns).to.deep.equal([
        'name',
        'type',
        'absolutePopulated',
        { key: 'percentFormatted', name: 'Percent' },
      ]);
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
    expect(sfCommandStubs.table.callCount).to.equal(1);
    expect(sfCommandStubs.table.args.flat()[0].columns).to.deep.equal([
      'name',
      'type',
      'absolutePopulated',
      { key: 'percentFormatted', name: 'Percent' },
      'defaultValue',
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
    expect(sfCommandStubs.table.callCount).to.equal(0);
    expect(sfCommandStubs.log.callCount).to.equal(1);
    // need to extract markdown output to dedicated formatter
    // for easier stubbing and testing. For now, just assert basic
    // markdown formatting in output -> first table column header
    expect(sfCommandStubs.log.args.flat()[0]).to.contain('| Name');
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
    expect(Object.keys(result.sobjects)).to.deep.equal(['Account', 'Order']);
    expect(result.sobjects.Account.name).to.equal('Account');
    expect(result.sobjects.Account.fields.length).to.equal($$.getFilterableFields());
    expect(result.sobjects.Order.name).to.equal('Order');
    expect(result.sobjects.Order.fields.length).to.equal($$.getFilterableFields());
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
});

export function stubMultiStageUx(sandbox: SinonSandbox): sinon.SinonStubbedInstance<MultiStageOutput<MultiStageData>> {
  const multiStageStub = sandbox.createStubInstance(MultiStageOutput);
  sandbox.stub(FieldUsageMultiStageOutput, 'newInstance').returns(multiStageStub);
  return multiStageStub;
}
