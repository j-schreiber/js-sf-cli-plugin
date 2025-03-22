import { expect } from 'chai';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import GarbageCollector from '../../src/garbage-collection/garbageCollector.js';
import {
  ALL_CUSTOM_OBJECTS,
  ENTITY_DEFINITION_QUERY,
  ALL_DEPRECATED_PACKAGE_MEMBERS,
} from '../../src/garbage-collection/queries.js';
import { EntityDefinition, Package2Member } from '../../src/types/sfToolingApiTypes.js';
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

  beforeEach(async () => {
    apiMocks = new GarbageCollectionMocks();
    testOrg.isDevHub = false;
    devhubOrg.isDevHub = true;
    await $$.stubAuths(testOrg, devhubOrg);
    $$.fakeConnectionRequest = mockQueryResults;
  });

  afterEach(() => {
    $$.SANDBOX.restore();
  });

  function mockQueryResults(request: AnyJson): Promise<AnyJson> {
    return apiMocks.mockQueryResults(request);
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
    expect(ALL_DEPRECATED_PACKAGE_MEMBERS).to.contain('FROM Package2Member');
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

  it('contains package details for all package members', async () => {
    // Arrange
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/mixed-with-package-infos.json');
    apiMocks.OBSOLETE_FLOW_VERSIONS = { records: [], totalSize: 0, done: true };

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const labels = garbage.deprecatedMembers['ExternalString'];
    labels.components.forEach((labelGarbage) => {
      expect(labelGarbage.deprecatedSinceVersion).to.equal('1.2.3');
      expect(labelGarbage.packageName).to.equal('My Test Package');
    });
    const layouts = garbage.deprecatedMembers['Layout'];
    layouts.components.forEach((layoutGarbage) => {
      expect(layoutGarbage.deprecatedSinceVersion).to.equal('1.2.4');
      expect(layoutGarbage.packageName).to.equal('My Test Package');
    });
  });

  it('includes all package members on partial garbage filter', async () => {
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
    expect(garbage.unsupported.length).to.equal(2);
    expect(garbage.unsupported[0]).to.deep.equal({
      keyPrefix: '00B',
      entityName: 'ListView',
      componentCount: 1,
      reason: messages.getMessage('infos.not-fully-supported-by-tooling-api', ['ListView', '00B', 1]),
    });
    expect(garbage.unsupported[1]).to.deep.equal({
      keyPrefix: '00l',
      entityName: 'Folder',
      componentCount: 1,
      reason: messages.getMessage('infos.not-yet-implemented', ['Folder', '00l', 1]),
    });
    expect(garbage.deprecatedMembers.CustomField.componentCount).to.equal(3);
    expect(garbage.deprecatedMembers.CustomMetadataRecord.componentCount).to.equal(7);
    expect(garbage.deprecatedMembers.CustomObject.componentCount).to.equal(2);
    expect(garbage.deprecatedMembers.ExternalString.componentCount).to.equal(2);
    expect(garbage.deprecatedMembers.FlowDefinition.componentCount).to.equal(8);
    expect(garbage.deprecatedMembers.Layout.componentCount).to.equal(2);
    expect(garbage.totalDeprecatedComponentCount).to.equal(24);
  });

  it('has unsupported metadata type in include filter > includes with not-supported reason', async () => {
    // Arrange
    // mocking correct query results is critical - the implementation does not
    // double-check results from the API and always assums, that database queries are correct
    apiMocks.PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/label-and-list-view.json');
    apiMocks.FILTERED_ENTITY_DEFINITIONS = parseMockResult<EntityDefinition>('label-listview-entity-definitions.json');

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export({ includeOnly: ['ExternalString', 'ListView'] });

    // Assert
    expect(garbage.unsupported).to.deep.equal([
      {
        entityName: 'ListView',
        keyPrefix: '00B',
        reason: messages.getMessage('infos.not-fully-supported-by-tooling-api', ['ListView', '00B', 1]),
        componentCount: 1,
      },
    ]);
    expect(Object.keys(garbage.deprecatedMembers)).to.deep.equal(['ExternalString']);
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
    expect(garbage.unsupported).to.deep.equal([], 'all types implemented');
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
    expect(garbage.unsupported).to.deep.equal([], 'all types implemented');
    const wfUpdate = garbage.deprecatedMembers['WorkflowFieldUpdate'];
    expect(wfUpdate).to.not.be.undefined;
    expect(wfUpdate.metadataType).to.equal('WorkflowFieldUpdate');
    expect(wfUpdate.componentCount).to.equal(1);
    const depComponents = wfUpdate.components;
    expect(depComponents.length).to.equal(1);
    expect(depComponents[0].fullyQualifiedName).to.equal('Account.My_Test_Field_Update');
  });

  it('emits events with details when resolving with metadata type filter', async () => {
    // Arrange
    const resolveListener = $$.SANDBOX.stub();

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    collector.addListener('resolveMemberStatus', resolveListener);
    // the default filtered entities are mocked in apiMocks.FILTERED_ENTITY_DEFINITIONS
    await collector.export({ includeOnly: ['ExternalString', 'CompanyData__mdt', 'Layout'] });

    // Assert
    expect(resolveListener.callCount).to.equal(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(resolveListener.args.flat()[0].message).to.contain('ExternalString,CompanyData__mdt,Layout');
    expect(resolveListener.args.flat()[1]).to.deep.contain({ message: 'Resolving 2 ExternalStrings (101)' });
    expect(resolveListener.args.flat()[2]).to.deep.contain({ message: 'Resolving 2 Layouts (00h)' });
    expect(resolveListener.args.flat()[3]).to.deep.contain({
      message: 'Resolving 7 CompanyData__mdt (m00) as CustomMetadata records.',
    });
  });

  it('filters metadata types with case-sensitive input > all matches are case-insensitive', async () => {
    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export({ includeOnly: ['EXTERNALstring', 'lAyOUT', 'CompanyDATA__mdt'] });

    // Assert
    expect(Object.keys(garbage.deprecatedMembers)).to.deep.equal(['ExternalString', 'Layout', 'CustomMetadataRecord']);
  });

  it('filters for packages > all package members belong to other packages', async () => {
    // Act
    // most package members are to subscriber id 0330X0000000000AAA
    // except flows, where first flow is 0330X0000000000AAA, second flow is 0330X0000000001AAA
    const collector = new GarbageCollector(await testOrg.getConnection(), await devhubOrg.getConnection());
    // resolves subscriber package id from apiMocks.PACKAGE_2 (0330X0000000000AAA)
    const result = await collector.export({ packages: ['0Ho000000000000AAA'] });

    // Assert
    expect(result.deprecatedMembers.ExternalString.components.length).to.equal(1);
    expect(result.deprecatedMembers.CustomField.components.length).to.equal(3);
    expect(result.deprecatedMembers.CustomObject.components.length).to.equal(2);
    expect(result.deprecatedMembers.Layout.components.length).to.equal(2);
    expect(result.deprecatedMembers.FlowDefinition.components.length).to.equal(5);
  });
});
