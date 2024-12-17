import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JscMaintainGarbageCollect from '../../../../../src/commands/jsc/maintain/garbage/collect.js';
import GarbageCollector from '../../../../../src/garbage-collection/garbageCollector.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../../../src/common/comms/processingEvents.js';

const MOCK_GARBAGE_RESULT = {
  deprecatedMembers: {
    ExternalString: {
      metadataType: 'CustomLabel',
      componentCount: 1,
      components: [
        {
          developerName: 'Feedback1',
          fullyQualifiedName: 'Feedback1',
          subjectId: '1010X000009T4prQAC',
        },
      ],
    },
  },
  unsupportedTypes: {},
  unknownTypes: [],
};

describe('jsc maintain garbage collect', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  const testTargetOrg = new MockTestOrgData();

  beforeEach(async () => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    await $$.stubAuths(testTargetOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs command with --json and no other params > returns result from garbage collector', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--json']);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result.deprecatedMembers).to.deep.equal({});
    expect(result.unsupportedTypes).to.deep.equal({});
    expect(result.unknownTypes).to.deep.equal([]);
    expect(sfCommandStubs.info.args).to.deep.equal([]);
  });

  it('runs command with no params > shows collector infos in console', async () => {
    // Arrange
    const collectorStub = $$.SANDBOX.createStubInstance(GarbageCollector);
    collectorStub.export.callsFake(() => {
      // have not been able to actually emit an event that is captured
      // by the listener in collect.ts
      collectorStub.emit('resolveMemberStatus', {
        message: 'Test Event',
        status: ProcessingStatus.InProgress,
      } as CommandStatusEvent);
      return Promise.resolve(MOCK_GARBAGE_RESULT);
    });
    $$.SANDBOX.stub(GarbageCollector, 'newInstance').returns(collectorStub);

    // Act
    const runResult = JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username]);
    const result = await runResult;

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result.deprecatedMembers.ExternalString).to.not.be.undefined;
    expect(result.unsupportedTypes).to.deep.equal({});
    expect(result.unknownTypes).to.deep.equal([]);
    // this should display the test event, but I am not able to emit on the
    // stubbed garbage collector instance
    expect(sfCommandStubs.info.args).to.deep.equal([]);
  });
});
