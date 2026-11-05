import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import sinon from 'sinon';
import { stubPrompter, stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import {
  ComponentSet,
  DeploySetOptions,
  DestructiveChangesType,
  MetadataApiDeploy,
} from '@salesforce/source-deploy-retrieve';
import JscMaintainGarbageDispose from '../../../../../src/commands/jsc/maintain/garbage/dispose.js';
import GarbageCollector from '../../../../../src/garbage-collection/garbageCollector.js';
import { PackageGarbageResult } from '../../../../../src/garbage-collection/packageGarbageTypes.js';

function mockGarbage(): PackageGarbageResult {
  return {
    deprecatedMembers: {
      ExternalString: {
        metadataType: 'CustomLabel',
        componentCount: 2,
        components: [
          {
            developerName: 'Feedback1',
            fullyQualifiedName: 'Feedback1',
            subjectId: '1010X000009T4prQAC',
            subscriberPackageId: '0330X0000000000AAA',
          },
          {
            developerName: 'Label_2',
            fullyQualifiedName: 'Label_2',
            subjectId: '1010X000009T4pqQAC',
            subscriberPackageId: '0330X0000000000AAA',
          },
        ],
      },
      CustomField: {
        metadataType: 'CustomField',
        componentCount: 1,
        components: [
          {
            developerName: 'TestField',
            fullyQualifiedName: 'TestObject__c.TestField__c',
            subjectId: '00N0X000009T5prQAC',
            subscriberPackageId: '0330X0000000000AAA',
          },
        ],
      },
    },
    unsupported: [],
    totalDeprecatedComponentCount: 3,
  };
}

const EMPTY_GARBAGE: PackageGarbageResult = {
  deprecatedMembers: {},
  unsupported: [],
  totalDeprecatedComponentCount: 0,
};

const SUCCESS = { success: true, status: 'Succeeded', runTestsEnabled: false, details: {} };

const FIELD_FAILURE = {
  success: false,
  status: 'Failed',
  details: {
    // a single failure is returned as object, not as array
    componentFailures: {
      componentType: 'CustomField',
      fullName: 'TestObject__c.TestField__c',
      problem: 'Field is referenced by Apex Class',
    },
  },
};

type DeployCall = { set: ComponentSet; options: DeploySetOptions };

describe('jsc maintain garbage dispose', () => {
  const $$ = new TestContext();
  const testTargetOrg = new MockTestOrgData();
  let uxStubs: ReturnType<typeof stubSfCommandUx>;
  let prompterStubs: ReturnType<typeof stubPrompter>;
  let deployCalls: DeployCall[];
  let deployRecentValidationCalls: number;

  /**
   * Each call to `ComponentSet.deploy` (validation or deploy) returns
   * the next response from the list.
   */
  function stubDeployResponses(...responses: Array<Record<string, unknown>>): void {
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').callsFake(function (this: ComponentSet, options) {
      const response = { id: `0Af00000000000${deployCalls.length}`, ...responses[deployCalls.length] };
      deployCalls.push({ set: this, options });
      return Promise.resolve({
        id: response.id,
        onUpdate: () => {},
        pollStatus: () => Promise.resolve({ response }),
        deployRecentValidation: () => {
          deployRecentValidationCalls++;
          return Promise.resolve('0Af0000000000QD');
        },
      } as unknown as MetadataApiDeploy);
    });
  }

  /**
   * First call collects garbage before the deploy, second call verifies
   * the deletions after the deploy (by default, all garbage is gone).
   */
  function stubExport(before: PackageGarbageResult, after: PackageGarbageResult = EMPTY_GARBAGE): sinon.SinonStub {
    return $$.SANDBOX.stub(GarbageCollector.prototype, 'export')
      .onFirstCall()
      .resolves(before)
      .onSecondCall()
      .resolves(after);
  }

  function deployedComponents(call: DeployCall): string[] {
    return call.set
      .getSourceComponents()
      .toArray()
      .map((cmp) => `${cmp.type.name}:${cmp.fullName}`);
  }

  beforeEach(async () => {
    uxStubs = stubSfCommandUx($$.SANDBOX);
    prompterStubs = stubPrompter($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    deployCalls = [];
    deployRecentValidationCalls = 0;
    await $$.stubAuths(testTargetOrg);
  });

  afterEach(() => {
    $$.restore();
    process.removeAllListeners();
  });

  it('validates, prints tables before prompt and deploys all garbage as destructive changes', async () => {
    // Arrange
    stubExport(mockGarbage());
    prompterStubs.confirm.resolves(true);
    stubDeployResponses(SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(deployCalls.length).to.equal(2);
    expect(deployCalls[0].options.apiOptions?.checkOnly).to.be.true;
    expect(deployCalls[1].options.apiOptions?.checkOnly).to.not.be.true;
    expect(deployedComponents(deployCalls[1])).to.have.members([
      'CustomLabel:Feedback1',
      'CustomLabel:Label_2',
      'CustomField:TestObject__c.TestField__c',
    ]);
    deployCalls[1].set
      .getSourceComponents()
      .toArray()
      .forEach((cmp) => expect(cmp.getDestructiveChangesType()).to.equal(DestructiveChangesType.POST));
    expect(uxStubs.table.calledBefore(prompterStubs.confirm)).to.be.true;
    expect(uxStubs.table.args[0][0].data.length).to.equal(3);
    expect(result.status).to.equal('Success');
    expect(result.deployId).to.equal('0Af000000000001');
    expect(Object.keys(result.disposed)).to.have.members(['ExternalString', 'CustomField']);
    expect(result.failed).to.deep.equal([]);
    expect(process.exitCode).to.equal(0);
  });

  it('removes failing components, validates again and deploys the rest > partial success', async () => {
    // Arrange
    stubExport(mockGarbage());
    prompterStubs.confirm.resolves(true);
    stubDeployResponses(FIELD_FAILURE, SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(deployCalls.length).to.equal(3);
    expect(deployCalls[1].options.apiOptions?.checkOnly).to.be.true;
    expect(deployedComponents(deployCalls[1])).to.have.members(['CustomLabel:Feedback1', 'CustomLabel:Label_2']);
    expect(deployedComponents(deployCalls[2])).to.have.members(['CustomLabel:Feedback1', 'CustomLabel:Label_2']);
    // deletable + not deletable, both before prompt
    expect(uxStubs.table.callCount).to.equal(2);
    expect(uxStubs.table.secondCall.calledBefore(prompterStubs.confirm.firstCall)).to.be.true;
    expect(uxStubs.table.args[0][0].data.length).to.equal(2);
    expect(result.status).to.equal('PartialSuccess');
    expect(Object.keys(result.disposed)).to.deep.equal(['ExternalString']);
    expect(result.disposed.ExternalString.componentCount).to.equal(2);
    expect(result.failed).to.deep.equal([
      {
        metadataType: 'CustomField',
        fullName: 'TestObject__c.TestField__c',
        subjectId: '00N0X000009T5prQAC',
        problem: 'Field is referenced by Apex Class',
      },
    ]);
    expect(uxStubs.warn.calledOnce).to.be.true;
    expect(process.exitCode).to.equal(0);
  });

  it('assigns failures reported for destructiveChanges.xml to the mentioned component', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses(
      {
        success: false,
        status: 'Failed',
        details: {
          componentFailures: [
            {
              componentType: 'CustomLabel',
              fullName: 'destructiveChanges.xml',
              problem: 'Cannot delete Label_2, it is referenced by an Apex class',
            },
            // same failure reported twice, must not be duplicated
            {
              componentType: 'CustomLabel',
              fullName: 'destructiveChanges.xml',
              problem: 'Cannot delete Label_2, it is referenced by an Apex class',
            },
          ],
        },
      },
      SUCCESS,
      SUCCESS
    );

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('PartialSuccess');
    expect(result.failed).to.deep.equal([
      {
        metadataType: 'CustomLabel',
        fullName: 'Label_2',
        subjectId: '1010X000009T4pqQAC',
        problem: 'Cannot delete Label_2, it is referenced by an Apex class',
      },
    ]);
    expect(deployedComponents(deployCalls[2])).to.have.members([
      'CustomLabel:Feedback1',
      'CustomField:TestObject__c.TestField__c',
    ]);
  });

  it('assigns failures for destructiveChanges.xml to all components of the type, if none is mentioned', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses(
      {
        success: false,
        status: 'Failed',
        details: {
          componentFailures: {
            componentType: 'CustomLabel',
            fullName: 'destructiveChanges.xml',
            problem: 'Some labels are in use',
          },
        },
      },
      SUCCESS,
      SUCCESS
    );

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('PartialSuccess');
    expect(result.failed.map((f) => f.fullName)).to.have.members(['Feedback1', 'Label_2']);
    result.failed.forEach((f) => expect(f.problem).to.equal('Some labels are in use'));
    expect(deployedComponents(deployCalls[2])).to.deep.equal(['CustomField:TestObject__c.TestField__c']);
  });

  it('every failure belongs to a garbage component and is reported once', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses(
      {
        success: false,
        status: 'Failed',
        details: {
          componentFailures: [
            { componentType: 'CustomField', fullName: 'TestObject__c.TestField__c', problem: 'Problem 1' },
            { componentType: 'CustomField', fullName: 'destructiveChanges.xml', problem: 'Problem 2' },
            { componentType: 'ApexClass', fullName: 'destructiveChanges.xml', problem: 'Not part of the garbage' },
          ],
        },
      },
      SUCCESS,
      SUCCESS
    );

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.failed).to.deep.equal([
      {
        metadataType: 'CustomField',
        fullName: 'TestObject__c.TestField__c',
        subjectId: '00N0X000009T5prQAC',
        problem: 'Problem 1 | Problem 2',
      },
    ]);
  });

  it('only counts components as disposed that are gone after the deploy', async () => {
    // Arrange
    const stillPresent = mockGarbage();
    stillPresent.deprecatedMembers = { CustomField: stillPresent.deprecatedMembers.CustomField };
    stubExport(mockGarbage(), stillPresent);
    stubDeployResponses(SUCCESS, {
      ...SUCCESS,
      details: {
        // the org claims the field was deleted, but it is still present
        componentSuccesses: { componentType: 'CustomField', fullName: 'TestObject__c.TestField__c', deleted: 'true' },
      },
    });

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('PartialSuccess');
    expect(Object.keys(result.disposed)).to.deep.equal(['ExternalString']);
    expect(result.disposed.ExternalString.componentCount).to.equal(2);
    expect(result.failed.length).to.equal(1);
    expect(result.failed[0].fullName).to.equal('TestObject__c.TestField__c');
    expect(result.failed[0].subjectId).to.equal('00N0X000009T5prQAC');
    expect(result.failed[0].problem).to.be.a('string').and.not.be.empty;
    expect(process.exitCode).to.equal(0);
  });

  it('compares remaining garbage by id, not by name', async () => {
    // Arrange
    const renamed = mockGarbage();
    // e.g. children of deleted objects are named with the object id
    renamed.deprecatedMembers.CustomField.components[0].fullyQualifiedName = '01I000000000001.TestField__c';
    renamed.deprecatedMembers = { CustomField: renamed.deprecatedMembers.CustomField };
    stubExport(mockGarbage(), renamed);
    stubDeployResponses(SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('PartialSuccess');
    expect(result.failed.map((f) => f.subjectId)).to.deep.equal(['00N0X000009T5prQAC']);
  });

  it('fails if all deployed components are still present after the deploy', async () => {
    // Arrange
    stubExport(mockGarbage(), mockGarbage());
    stubDeployResponses(SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('Failed');
    expect(result.disposed).to.deep.equal({});
    expect(result.failed.length).to.equal(3);
    expect(process.exitCode).to.equal(1);
  });

  it('fails without prompt and deploy, if no component can be deleted', async () => {
    // Arrange
    const garbage = mockGarbage();
    garbage.deprecatedMembers = { CustomField: garbage.deprecatedMembers.CustomField };
    garbage.totalDeprecatedComponentCount = 1;
    stubExport(garbage);
    stubDeployResponses(FIELD_FAILURE);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(deployCalls.length).to.equal(1);
    expect(prompterStubs.confirm.called).to.be.false;
    expect(result.status).to.equal('Failed');
    expect(result.failed.length).to.equal(1);
    expect(process.exitCode).to.equal(1);
  });

  it('fails if validation fails without removable component failures', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses({ success: false, status: 'Failed', errorMessage: 'Org is locked', details: {} });

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(deployCalls.length).to.equal(1);
    expect(prompterStubs.confirm.called).to.be.false;
    expect(result.status).to.equal('Failed');
    expect(result.failed.length).to.equal(3);
    result.failed.forEach((failure) => expect(failure.problem).to.equal('Org is locked'));
    expect(process.exitCode).to.equal(1);
  });

  it('every failure has a problem, even if the deploy reports no error message', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses({ success: false, status: 'Failed', details: {} });

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(result.status).to.equal('Failed');
    expect(result.failed.length).to.equal(3);
    result.failed.forEach((failure) => expect(failure.problem).to.be.a('string').and.not.be.empty);
  });

  it('does not deploy if user declines prompt', async () => {
    // Arrange
    stubExport(mockGarbage());
    prompterStubs.confirm.resolves(false);
    stubDeployResponses(SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(deployCalls.length).to.equal(1);
    expect(deployCalls[0].options.apiOptions?.checkOnly).to.be.true;
    expect(result.status).to.equal('Skipped');
    expect(result.disposed).to.deep.equal({});
  });

  it('prints tables but does not prompt with --no-prompt', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses(SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(uxStubs.table.calledOnce).to.be.true;
    expect(prompterStubs.confirm.called).to.be.false;
    expect(deployCalls.length).to.equal(2);
    expect(result.status).to.equal('Success');
  });

  it('neither validates, prompts nor deploys when no garbage is found', async () => {
    // Arrange
    stubExport(EMPTY_GARBAGE);
    stubDeployResponses();

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(uxStubs.table.called).to.be.false;
    expect(prompterStubs.confirm.called).to.be.false;
    expect(deployCalls.length).to.equal(0);
    expect(result.status).to.equal('Skipped');
  });

  it('reports failed deploy after successful validation with exit code 1', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses(SUCCESS, FIELD_FAILURE);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.status).to.equal('Failed');
    expect(result.disposed).to.deep.equal({});
    expect(result.failed.length).to.equal(1);
    expect(result.failed[0].fullName).to.equal('TestObject__c.TestField__c');
    // deletable table + deploy failures table
    expect(uxStubs.table.callCount).to.equal(2);
    expect(process.exitCode).to.equal(1);
  });

  it('uses quick deploy if validation ran apex tests', async () => {
    // Arrange
    stubExport(mockGarbage());
    stubDeployResponses({ ...SUCCESS, runTestsEnabled: true });
    const quickDeployPoll = $$.SANDBOX.stub(MetadataApiDeploy.prototype, 'pollStatus').resolves({
      response: { ...SUCCESS, id: '0Af0000000000QD' },
    } as unknown as Awaited<ReturnType<MetadataApiDeploy['pollStatus']>>);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(deployCalls.length).to.equal(1);
    expect(deployRecentValidationCalls).to.equal(1);
    expect(quickDeployPoll.calledOnce).to.be.true;
    expect(result.status).to.equal('Success');
    expect(result.deployId).to.equal('0Af0000000000QD');
  });

  it('moves metadata types unknown to registry to unsupported', async () => {
    // Arrange
    const garbage = mockGarbage();
    garbage.deprecatedMembers.ExternalString.metadataType = 'NotARealType';
    stubExport(garbage);
    stubDeployResponses(SUCCESS, SUCCESS);

    // Act
    const result = await JscMaintainGarbageDispose.run(['--target-org', testTargetOrg.username, '--no-prompt']);

    // Assert
    expect(result.deprecatedMembers.ExternalString).to.be.undefined;
    expect(result.totalDeprecatedComponentCount).to.equal(1);
    expect(result.unsupported.length).to.equal(1);
    expect(result.unsupported[0].entityName).to.equal('ExternalString');
    expect(result.unsupported[0].componentCount).to.equal(2);
    expect(deployedComponents(deployCalls[0])).to.deep.equal(['CustomField:TestObject__c.TestField__c']);
  });
});
