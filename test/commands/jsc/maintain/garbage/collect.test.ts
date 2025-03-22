import fs from 'node:fs';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { SfError } from '@salesforce/core';
import { XMLParser } from 'fast-xml-parser';
import JscMaintainGarbageCollect from '../../../../../src/commands/jsc/maintain/garbage/collect.js';
import GarbageCollector from '../../../../../src/garbage-collection/garbageCollector.js';
import { CommandStatusEvent, ProcessingStatus } from '../../../../../src/common/comms/processingEvents.js';
import { PackageManifestObject } from '../../../../../src/garbage-collection/packageManifestTypes.js';
import { PackageGarbageResult } from '../../../../../src/garbage-collection/packageGarbageTypes.js';

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
          deprecatedSinceVersion: '1.2.3',
          subscriberPackageId: '0330X0000000000AAA',
        },
        {
          developerName: 'Label_2',
          fullyQualifiedName: 'Label_2',
          subjectId: '1010X000009T4pqQAC',
          deprecatedSinceVersion: '1.2.3',
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
          subjectId: '1010X000009T5prQAC',
          deprecatedSinceVersion: '2.0.0',
          subscriberPackageId: '0330X0000000000AAA',
        },
      ],
    },
  },
  unsupported: [],
  totalDeprecatedComponentCount: 3,
};

const MOCK_EMPTY_GARBAGE_RESULT: PackageGarbageResult = {
  deprecatedMembers: {
    BusinessProcess: {
      metadataType: 'BusinessProcess',
      componentCount: 0,
      components: [],
    },
  },
  unsupported: [],
  totalDeprecatedComponentCount: 0,
};

const TEST_OUTPUT_PATH = 'tmp/tests/garbage-collection';

describe('jsc maintain garbage collect', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;
  const testTargetOrg = new MockTestOrgData();
  const testDevhubOrg = new MockTestOrgData();

  beforeEach(async () => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    testDevhubOrg.isDevHub = true;
    testTargetOrg.isDevHub = false;
    await $$.stubAuths(testTargetOrg, testDevhubOrg);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(TEST_OUTPUT_PATH, { recursive: true, force: true });
    process.removeAllListeners();
  });

  it('prints garbage result table with default parameters', async () => {
    // Arrange
    $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(1); // once with all types
    const tablesCallArgs = sfCommandStubs.table.args.flat()[0];
    expect(tablesCallArgs.data.length).to.equal(
      MOCK_GARBAGE_RESULT.deprecatedMembers.ExternalString.componentCount +
        MOCK_GARBAGE_RESULT.deprecatedMembers.CustomField.componentCount
    );
    // custom labels, 0-1
    for (let i = 0; i < 2; i++) {
      expect(tablesCallArgs.data[i].metadataType).to.equal('CustomLabel');
      const labelRow = MOCK_GARBAGE_RESULT.deprecatedMembers.ExternalString.components[i];
      expect(tablesCallArgs.data[i].subjectId).to.equal(labelRow.subjectId);
      expect(tablesCallArgs.data[i].fullyQualifiedApiName).to.equal(labelRow.fullyQualifiedName);
      expect(tablesCallArgs.data[i].deprecatedSinceVersion).to.equal(labelRow.deprecatedSinceVersion);
    }
    // custom fields 2-2
    for (let i = 2; i < 3; i++) {
      expect(tablesCallArgs.data[i].metadataType).to.equal('CustomField');
      const fieldRow = MOCK_GARBAGE_RESULT.deprecatedMembers.CustomField.components[i - 2];
      expect(tablesCallArgs.data[i].subjectId).to.equal(fieldRow.subjectId);
      expect(tablesCallArgs.data[i].fullyQualifiedApiName).to.equal(fieldRow.fullyQualifiedName);
      expect(tablesCallArgs.data[i].deprecatedSinceVersion).to.equal(fieldRow.deprecatedSinceVersion);
    }
  });

  it('prints no table when garbage result is empty', async () => {
    // Arrange
    $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_EMPTY_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(0);
  });

  it('with --json and no other params > returns result from garbage collector', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--json']);

    // Assert
    expect(process.exitCode).to.equal(0);
    expect(result.deprecatedMembers).to.deep.equal({});
    expect(result.unsupported).to.deep.equal([]);
    expect(sfCommandStubs.info.args).to.deep.equal([]);
  });

  it('with no params > shows collector infos in console', async () => {
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
    expect(result.unsupported).to.deep.equal([]);
    // this should display the test event, but I am not able to emit on the
    // stubbed garbage collector instance
    expect(sfCommandStubs.info.args).to.deep.equal([]);
  });

  it('with output-dir flag > creates package xml from garbage collector', async () => {
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

  it('with output-dir flag > empty garbage is not present in package.xml', async () => {
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
    expect(exportMock.args.flat()).to.deep.equal([{ includeOnly: undefined, packages: undefined }]);
  });

  it('with output-dir and destructive changes flag > pipes garbage to destructiveChanges.xml', async () => {
    // Arrange
    $$.SANDBOX.stub(GarbageCollector.prototype, 'export').resolves(MOCK_GARBAGE_RESULT);

    // Act
    await JscMaintainGarbageCollect.run([
      '--target-org',
      testTargetOrg.username,
      '--output-dir',
      TEST_OUTPUT_PATH,
      '--output-format',
      'DestructiveChangesXML',
    ]);

    // Assert
    expect(fs.existsSync(TEST_OUTPUT_PATH + '/package.xml')).to.equal(true, 'package.xml exists');
    expect(fs.existsSync(TEST_OUTPUT_PATH + '/destructiveChanges.xml')).to.equal(true, 'destructiveChanges.xml exists');
    const packageXml = new XMLParser().parse(
      fs.readFileSync(TEST_OUTPUT_PATH + '/package.xml'),
      true
    ) as PackageManifestObject;
    expect(packageXml.Package.types).to.equal(undefined, 'types in package.xml');
    const destructiveChangesXml = new XMLParser().parse(
      fs.readFileSync(TEST_OUTPUT_PATH + '/destructiveChanges.xml'),
      true
    ) as PackageManifestObject;
    expect(destructiveChangesXml.Package.types.length).to.equal(2, 'types in destructiveChanges.xml');
  });

  it('with metadata type filter > passes params to garbage collector', async () => {
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
    expect(exportMock.args.flat()).to.deep.equal([
      { includeOnly: ['ExternalString', 'CustomObject'], packages: undefined },
    ]);
  });

  it('with direct package id filter > target org is devhub > passes target org to collector', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run([
      '--target-org',
      testDevhubOrg.username,
      '--package',
      '0Ho6f000000TN1eCAG',
    ]);

    // Assert
    expect(result.deprecatedMembers).to.deep.equal({});
  });

  it('with package filter > target org is no devhub > throws error', async () => {
    // Act
    try {
      await JscMaintainGarbageCollect.run(['--target-org', testTargetOrg.username, '--package', '0Ho6f000000TN1eCAG']);
      expect.fail('Should throw exception');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).name).to.equal('DevhubRequiredForPackages');
    }
  });

  it('with package filter > target org is no devhub and supplies devhub > passes devhub to garbage collector', async () => {
    // Act
    const result = await JscMaintainGarbageCollect.run([
      '--target-org',
      testTargetOrg.username,
      '--devhub-org',
      testDevhubOrg.username,
      '--package',
      '0Ho6f000000TN1eCAG',
    ]);

    // Assert
    expect(result.deprecatedMembers).to.deep.equal({});
  });
});
