import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { Record } from '@jsforce/jsforce-node';
import { Messages } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import GarbageCollector from '../../src/garbage-collection/garbageCollector.js';
import QueryRunner from '../../src/common/utils/queryRunner.js';
import {
  ALL_CUSTOM_OBJECTS,
  ENTITY_DEFINITION_QUERY,
  PACKAGE_MEMBER_QUERY,
} from '../../src/garbage-collection/queries.js';
import { Package2Member } from '../../src/types/sfToolingApiTypes.js';
import {
  loadSupportedMetadataTypes,
  loadUnsupportedMetadataTypes,
} from '../../src/garbage-collection/entity-handlers/index.js';
import GarbageCollectionMocks, { parseMockResult } from '../mock-utils/garbageCollectionMocks.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

describe('garbage collector', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const devhubOrg = new MockTestOrgData();

  let apiMocks: GarbageCollectionMocks;
  let fetchRecordsStub: SinonStub;

  beforeEach(async () => {
    apiMocks = new GarbageCollectionMocks();
    testOrg.isDevHub = false;
    devhubOrg.isDevHub = true;
    await $$.stubAuths(testOrg, devhubOrg);
    fetchRecordsStub = $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords');
    fetchRecordsStub.callsFake(fakeFetchRecords);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
  });

  function fakeFetchRecords<T extends Record>(queryString: string): Promise<Record[]> {
    return apiMocks.fetchRecordsStub<T>(queryString);
  }

  it('registry loads all supported and unsupported handlers', async () => {
    // Act
    const supportedTypes = loadSupportedMetadataTypes(await testOrg.getConnection());
    const unsupportedTypes = loadUnsupportedMetadataTypes();

    // Assert
    expect(supportedTypes['ExternalString']).to.not.be.undefined;
    expect(supportedTypes['CustomObject']).to.not.be.undefined;
    expect(supportedTypes['CustomField']).to.not.be.undefined;
    expect(supportedTypes['CustomMetadataRecord']).to.not.be.undefined;
    expect(supportedTypes['CustomTab']).to.not.be.undefined;
    expect(unsupportedTypes['ListView']).to.not.be.undefined;
  });

  it('has all queries initialised', async () => {
    expect(PACKAGE_MEMBER_QUERY).to.contain('FROM Package2Member');
    expect(ENTITY_DEFINITION_QUERY).to.contain('FROM EntityDefinition');
    expect(ALL_CUSTOM_OBJECTS).to.contain("FROM EntityDefinition WHERE KeyPrefix LIKE 'a%");
  });

  it('fetches package members and organizes results', async () => {
    // Arrange
    apiMocks.OBSOLETE_FLOW_VERSIONS = { records: [], totalSize: 0, done: true };

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const labels = garbage.deprecatedMembers['ExternalString'];
    expect(labels).to.not.be.undefined;
    expect(labels.metadataType).to.equal('CustomLabel');
    const labelComponents = labels.components;
    expect(labelComponents.length).to.equal(2);
    expect(labelComponents[0].developerName).to.equal('Test_Label_2');
    expect(labelComponents[0].fullyQualifiedName).to.equal('Test_Label_2');
    expect(labelComponents[1].developerName).to.equal('Test_Label_1');
    expect(labelComponents[1].fullyQualifiedName).to.equal('Test_Label_1');
    const customObjs = garbage.deprecatedMembers['CustomObject'];
    expect(customObjs).to.not.be.undefined;
    expect(customObjs.metadataType).to.equal('CustomObject');
    const customObjsComponents = customObjs.components;
    expect(customObjsComponents.length).to.equal(2);
    expect(customObjsComponents[0].developerName).to.equal('Payment');
    expect(customObjsComponents[0].fullyQualifiedName).to.equal('Payment__c');
    expect(customObjsComponents[1].developerName).to.equal('CompanyData');
    expect(customObjsComponents[1].fullyQualifiedName).to.equal('CompanyData__mdt');
    expect(garbage.deprecatedMembers['Flow']).to.be.undefined;
  });

  it('receives mixed package members and has no export filter > includes all types', async () => {
    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export({ includeOnly: undefined });

    // Assert
    expect(Object.keys(garbage.deprecatedMembers)).deep.equal([
      'ExternalString',
      'FlowDefinition',
      'Layout',
      'CustomField',
      'CustomObject',
      'CustomMetadataRecord',
    ]);
    expect(Object.keys(garbage.ignoredTypes)).deep.equal(['ListView']);
    const expectedReason = messages.getMessage('infos.not-fully-supported-by-tooling-api');
    expect(garbage.ignoredTypes['ListView'].reason).to.equal(expectedReason);
    expect(garbage.deprecatedMembers.CustomField.componentCount).to.equal(3);
    expect(garbage.deprecatedMembers.CustomMetadataRecord.componentCount).to.equal(7);
    expect(garbage.deprecatedMembers.CustomObject.componentCount).to.equal(2);
    expect(garbage.deprecatedMembers.ExternalString.componentCount).to.equal(2);
    expect(garbage.deprecatedMembers.FlowDefinition.componentCount).to.equal(8);
    expect(garbage.deprecatedMembers.Layout.componentCount).to.equal(0);
    expect(garbage.totalDeprecatedComponentCount).to.equal(22);
  });

  it('has unsupported metadata type in include filter > includes with not-supported reason', async () => {
    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export({ includeOnly: ['ExternalString', 'ListView'] });

    // Assert
    expect(Object.keys(garbage.ignoredTypes)).contain('ListView');
    const expectedReason = messages.getMessage('infos.not-fully-supported-by-tooling-api');
    expect(garbage.ignoredTypes['ListView'].reason).to.equal(expectedReason);
  });

  it('package members have custom field > resolves only undeleted custom field components', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/custom-fields.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const customFields = garbage.deprecatedMembers['CustomField'];
    expect(customFields).to.not.be.undefined;
    expect(customFields.metadataType).to.equal('CustomField');
    const fieldsList = customFields.components;
    expect(fieldsList.length).to.equal(2);
    expect(fieldsList[0].developerName).to.equal('HoursPerDay');
    expect(fieldsList[0].fullyQualifiedName).to.equal('Resource__c.HoursPerDay__c');
    expect(fieldsList[1].developerName).to.equal('HourlyRate');
    expect(fieldsList[1].fullyQualifiedName).to.equal('Resource__c.HourlyRate__c');
  });

  it('package members have quick action > resolves quick action components', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/quick-action.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const quickActions = garbage.deprecatedMembers['QuickActionDefinition'];
    expect(quickActions).to.not.be.undefined;
    expect(quickActions.metadataType).to.equal('QuickAction');
    const fieldsList = quickActions.components;
    expect(fieldsList.length).to.equal(1);
    expect(fieldsList[0].developerName).to.equal('New_ChargePilot_Contract');
    expect(fieldsList[0].fullyQualifiedName).to.equal('Account.New_ChargePilot_Contract');
  });

  it('package members have layouts > resolves layout components', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/layouts.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const quickActions = garbage.deprecatedMembers['Layout'];
    expect(quickActions).to.not.be.undefined;
    expect(quickActions.metadataType).to.equal('Layout');
    const fieldsList = quickActions.components;
    expect(fieldsList.length).to.equal(3);
    expect(fieldsList[0].fullyQualifiedName).to.equal('ServiceContract-Service Contract Layout');
    expect(fieldsList[1].fullyQualifiedName).to.equal('Pricebook2-Price Book Layout');
    expect(fieldsList[2].fullyQualifiedName).to.equal('OrganizationProfile__c-Organization Profile Layout');
  });

  it('org has obsolete flow versions > includes each version', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = { records: [], totalSize: 0, done: true };

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const flowVersions = garbage.deprecatedMembers['FlowDefinition'];
    expect(flowVersions).to.not.be.undefined;
    expect(flowVersions.metadataType).to.equal('Flow');
    const flowsList = flowVersions.components;
    expect(flowsList.length).to.equal(8);
    expect(flowsList[0].fullyQualifiedName).to.equal('My_First_Test_Flow-1');
    expect(flowsList[1].fullyQualifiedName).to.equal('My_First_Test_Flow-2');
    expect(flowsList[2].fullyQualifiedName).to.equal('My_First_Test_Flow-3');
    expect(flowsList[3].fullyQualifiedName).to.equal('My_First_Test_Flow-4');
    expect(flowsList[4].fullyQualifiedName).to.equal('My_First_Test_Flow-5');
    expect(flowsList[5].fullyQualifiedName).to.equal('My_Second_Test_Flow-1');
    expect(flowsList[6].fullyQualifiedName).to.equal('My_Second_Test_Flow-2');
    expect(flowsList[7].fullyQualifiedName).to.equal('My_Second_Test_Flow-3');
  });

  it('has custom metadata types deprecated > includes custom metadata', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/cmd-records.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const customMetadatas = garbage.deprecatedMembers['CustomMetadataRecord'];
    expect(customMetadatas).to.not.be.undefined;
    expect(customMetadatas.metadataType).to.equal('CustomMetadata');
    const depComponents = customMetadatas.components;
    expect(depComponents.length).to.equal(3);
    expect(customMetadatas.componentCount).to.equal(3);
    expect(depComponents[0].fullyQualifiedName).to.equal('CompanyData.NAME');
    expect(depComponents[1].fullyQualifiedName).to.equal('CompanyData.PHONE');
    expect(depComponents[2].fullyQualifiedName).to.equal('HandlerControl.Invoice');
  });

  it('package members have workflow alerts > resolves entity def and alert name', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/workflow-alerts.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    expect(garbage.notImplementedTypes).to.deep.equal([], 'all types implemented');
    const wfAlerts = garbage.deprecatedMembers['WorkflowAlert'];
    expect(wfAlerts).to.not.be.undefined;
    expect(wfAlerts.metadataType).to.equal('WorkflowAlert');
    expect(wfAlerts.componentCount).to.equal(3);
    const depComponents = wfAlerts.components;
    expect(depComponents.length).to.equal(3);
    expect(depComponents[0].fullyQualifiedName).to.equal('Case.Test_Alert_1');
    expect(depComponents[1].fullyQualifiedName).to.equal('CustomObject__c.Test_Alert_2');
    expect(depComponents[2].fullyQualifiedName).to.equal('CustomObject__c.Test_Alert_3');
  });

  it('package members with workflow field updates > resolves with full name', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/workflow-field-updates.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    expect(garbage.notImplementedTypes).to.deep.equal([], 'all types implemented');
    const wfUpdate = garbage.deprecatedMembers['WorkflowFieldUpdate'];
    expect(wfUpdate).to.not.be.undefined;
    expect(wfUpdate.metadataType).to.equal('WorkflowFieldUpdate');
    expect(wfUpdate.componentCount).to.equal(1);
    const depComponents = wfUpdate.components;
    expect(depComponents.length).to.equal(1);
    expect(depComponents[0].fullyQualifiedName).to.equal('Account.My_Test_Field_Update');
  });

  it('filters metadata present in package members > only includes requested metadata', async () => {
    // Arrange
    const resolveListener = $$.SANDBOX.stub();

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    collector.addListener('resolveMemberStatus', resolveListener);
    const garbage = await collector.export({ includeOnly: ['CustomObject', 'CustomField'] });

    // Assert
    // custom fields contain 4 members, including 1 deleted field.
    // this resolves to 3 fields only
    expect(resolveListener.callCount).to.equal(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(resolveListener.args.flat()[0].message).to.contain('CustomObject,CustomField');
    expect(resolveListener.args.flat()[1]).to.deep.contain({ message: 'Resolving 4 CustomFields (00N)' });
    expect(resolveListener.args.flat()[2]).to.deep.contain({
      message: 'Package members resolved to 3 actual CustomField(s).',
    });
    expect(resolveListener.args.flat()[3]).to.deep.contain({ message: 'Resolving 2 CustomObjects (01I)' });
    expect(Object.keys(garbage.deprecatedMembers)).to.deep.equal(['CustomField', 'CustomObject']);
    expect(Object.keys(garbage.ignoredTypes)).to.deep.equal([
      'ExternalString',
      'FlowDefinition',
      'ListView',
      'Layout',
      'Folder',
      'CompanyData__mdt',
    ]);
    const expectedReason = messages.getMessage('infos.excluded-from-result-not-in-filter');
    expect(garbage.ignoredTypes['ExternalString'].reason).to.equal(expectedReason);
    expect(garbage.ignoredTypes['ListView'].reason).to.equal(expectedReason);
    expect(garbage.ignoredTypes['CompanyData__mdt'].reason).to.equal(expectedReason);
  });

  it('filters metadata types with case-sensitive input > all matches are case-insensitive', async () => {
    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export({ includeOnly: ['EXTERNALstring', 'CuStOmFIELD'] });

    // Assert
    expect(Object.keys(garbage.deprecatedMembers)).to.deep.equal(['ExternalString', 'CustomField']);
  });

  it('filters for packages > relevant queries include package ids', async () => {
    // Act
    const collector = new GarbageCollector(await testOrg.getConnection(), await devhubOrg.getConnection());
    const result = await collector.export({ packages: ['0Ho6f000000TN1eCAG'] });

    // Assert
    // packages are filtered - first query must be to Package2
    expect(fetchRecordsStub.args.flat()[0]).to.contain("FROM Package2 WHERE Id IN ('0Ho6f000000TN1eCAG')");
    // SubscriberPackageId' can not be filtered in a query call, therefore we must filter manually
    expect(fetchRecordsStub.args.flat()[1]).to.contain(
      "FROM Package2Member WHERE SubjectManageableState IN ('deprecatedEditable', 'deprecated')"
    );
    expect(result.deprecatedMembers.ExternalString.components.length).to.equal(1);
    expect(result.deprecatedMembers.ExternalString.componentCount).to.equal(1);
    expect(result.deprecatedMembers.CustomMetadataRecord.components.length).to.equal(1);
    expect(result.deprecatedMembers.CustomMetadataRecord.componentCount).to.equal(1);
    expect(result.ignoredTypes.ListView.componentCount).to.equal(1);
  });

  it('filters for packages > all package members belong to other packages', async () => {
    // Arrange
    // package members are to subscriber id 0330X0000000000AAA
    // expect flows, where first flow is 0330X0000000000AAA, second flow is 033000000000001AAA
    apiMocks.PACKAGE_2.records[0].SubscriberPackageId = '033000000000001AAA';

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection(), await devhubOrg.getConnection());
    const result = await collector.export({ packages: ['0Ho000000000001AAA'] });

    // Assert
    // packages are filtered - first query must be to Package2
    expect(fetchRecordsStub.args.flat()[0]).to.contain("FROM Package2 WHERE Id IN ('0Ho000000000001AAA')");
    expect(result.deprecatedMembers.ExternalString.components.length).to.equal(0);
    expect(result.deprecatedMembers.CustomField.components.length).to.equal(0);
    expect(result.deprecatedMembers.CustomObject.components.length).to.equal(0);
    expect(result.deprecatedMembers.Layout.components.length).to.equal(0);
    expect(result.deprecatedMembers.FlowDefinition.components.length).to.equal(3);
  });
});
