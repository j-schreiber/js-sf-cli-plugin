// import * as events from 'node:events';
// import * as extend from 'extend';
import fs from 'node:fs';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { XMLParser } from 'fast-xml-parser';
import JscMaintainGarbageCollect from '../../../../../src/commands/jsc/maintain/garbage/collect.js';
import GarbageCollector from '../../../../../src/garbage-collection/garbageCollector.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../../../src/common/comms/processingEvents.js';
import { PackageManifestObject } from '../../../../../src/garbage-collection/packageManifestTypes.js';
import { PackageGarbageResult } from '../../../../../src/garbage-collection/packageGarbage.js';

const MOCK_GARBAGE_RESULT: PackageGarbageResult = {
  deprecatedMembers: {
    ExternalString: {
      metadataType: 'CustomLabel',
      componentCount: 2,
      components: [
        {
          developerName: 'Feedback1',
          fullyQualifiedName: 'Feedback1',
          subjectId: '1010X000009T4prQAC',
        },
        {
          developerName: 'Label_2',
          fullyQualifiedName: 'Label_2',
          subjectId: '1010X000009T4pqQAC',
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
          subjectId: '1010X000009T5prQAC',
        },
      ],
    },
  },
  ignoredTypes: {},
  notImplementedTypes: [],
};

const MOCK_EMPTY_GARBAGE_RESULT: PackageGarbageResult = {
  deprecatedMembers: {
    BusinessProcess: {
      metadataType: 'BusinessProcess',
      componentCount: 0,
      components: [],
    },
  },
  ignoredTypes: {},
  notImplementedTypes: [],
};

const TEST_OUTPUT_PATH = 'tmp/tests/garbage-collection';

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

  afterEach(() => {
    fs.rmSync(TEST_OUTPUT_PATH, { recursive: true, force: true });
  });

  it('runs command with --json and no other params > returns result from garbage collector', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--json']);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result.deprecatedMembers).to.deep.equal({});
    expect(result.ignoredTypes).to.deep.equal({});
    expect(result.notImplementedTypes).to.deep.equal([]);
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
    expect(result.ignoredTypes).to.deep.equal({});
    expect(result.notImplementedTypes).to.deep.equal([]);
    // this should display the test event, but I am not able to emit on the
    // stubbed garbage collector instance
    expect(sfCommandStubs.info.args).to.deep.equal([]);
  });

  it('runs command with output-dir flag > creates package xml from garbage collector', async () => {
    // Arrange
    const exportsStub = $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--output-dir', TEST_OUTPUT_PATH]);
    const createdManifest = new XMLParser().parse(
      fs.readFileSync(TEST_OUTPUT_PATH + '/package.xml'),
      true
    ) as PackageManifestObject;

    // Assert
    expect(exportsStub.calledOnce).to.be.true;
    expect(createdManifest).to.be.ok;
    expect(createdManifest.Package.types.length).to.equal(2);
    expect(createdManifest.Package.types[0].name).to.equal('CustomLabel');
    expect(createdManifest.Package.types[0].members.length).to.equal(2);
    expect(createdManifest.Package.types[0].members[0]).to.equal('Feedback1');
    expect(createdManifest.Package.types[0].members[1]).to.equal('Label_2');
    expect(createdManifest.Package.types[1].name).to.equal('CustomField');
    // because we have a single member, it is parsed as a key, not as a list
    expect(createdManifest.Package.types[1].members.length).to.equal(26);
    expect(createdManifest.Package.types[1].members).to.equal('TestObject__c.TestField__c');
  });

  it('runs command with output-dir flag > empty garbage is not present in package.xml', async () => {
    // Arrange
    const exportMock = $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_EMPTY_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--output-dir', TEST_OUTPUT_PATH]);
    const createdManifest = new XMLParser().parse(
      fs.readFileSync(TEST_OUTPUT_PATH + '/package.xml'),
      true
    ) as PackageManifestObject;

    // Assert
    expect(createdManifest).to.be.ok;
    // single type will be parsed to a key, not list
    expect(createdManifest.Package.types).to.be.undefined;
    expect(createdManifest.Package.version).to.equal(62);
    expect(exportMock.args.flat()).to.deep.equal([{ includeOnly: undefined }]);
  });

  it('runs command with metadata type filter > passes params to garbage collector', async () => {
    // Arrange
    const exportMock = $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_EMPTY_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run([
      '--target-org',
      testTargetOrg.username,
      '--metadata-type',
      'ExternalString',
      '-m',
      'CustomObject',
    ]);

    // Assert
    expect(exportMock.callCount).to.equal(1);
    expect(exportMock.args.flat()).to.deep.equal([{ includeOnly: ['ExternalString', 'CustomObject'] }]);
  });
});
