import fs from 'node:fs';
import { expect } from 'chai';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import GarbageCollector from '../../src/garbage-collection/garbageCollector.js';
import QueryRunner from '../../src/common/utils/queryRunner.js';
import {
  ALL_CUSTOM_OBJECTS,
  ENTITY_DEFINITION_QUERY,
  PACKAGE_MEMBER_QUERY,
} from '../../src/garbage-collection/queries/queries.js';
import { EntityDefinition, FieldDefinition, NamedRecord, Package2Member } from '../../src/types/sfToolingApiTypes.js';
import { PackageGarbage } from '../../src/garbage-collection/packageGarbage.js';

const testDataPath = 'test/garbage-collection/data';

let PACKAGE_2_MEMBERS = JSON.parse(
  fs.readFileSync(`${testDataPath}/package-members/mixed.json`, 'utf8')
) as QueryResult<Package2Member>;
const ENTITY_DEFINITIONS = JSON.parse(
  fs.readFileSync(testDataPath + '/entity-definitions.json', 'utf8')
) as QueryResult<EntityDefinition>;
const CUSTOM_LABELS = JSON.parse(
  fs.readFileSync(testDataPath + '/custom-labels.json', 'utf8')
) as QueryResult<NamedRecord>;
const CUSTOM_OBJECT_ENTITY_DEFS = JSON.parse(
  fs.readFileSync(testDataPath + '/custom-object-entity-defs.json', 'utf8')
) as QueryResult<NamedRecord>;
const ALL_CUSTOM_FIELDS = JSON.parse(
  fs.readFileSync(testDataPath + '/all-custom-fields.json', 'utf8')
) as QueryResult<FieldDefinition>;
const ALL_QUICK_ACTIONS = JSON.parse(
  fs.readFileSync(testDataPath + '/all-quick-actions.json', 'utf8')
) as QueryResult<FieldDefinition>;
const ALL_LAYOUTS = JSON.parse(fs.readFileSync(testDataPath + '/layouts.json', 'utf8')) as QueryResult<FieldDefinition>;

describe('garbage collector', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  it('has all queries initialised', async () => {
    expect(PACKAGE_MEMBER_QUERY).to.contain('FROM Package2Member');
    expect(ENTITY_DEFINITION_QUERY).to.contain('FROM EntityDefinition');
    expect(ALL_CUSTOM_OBJECTS).to.contain("FROM EntityDefinition WHERE KeyPrefix LIKE 'a%");
  });

  it('fetches package members and organizes results', async () => {
    // Arrange
    const stubMethod = $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords');
    stubMethod.callsFake(fakeFetchRecords);

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const labels = garbage.deprecatedMembers['ExternalString'];
    expect(labels).to.not.be.undefined;
    expect(labels.metadataType).to.equal('CustomLabel');
    const labelComponents = labels.components as PackageGarbage[];
    expect(labelComponents.length).to.equal(2);
    expect(labelComponents[0].developerName).to.equal('Test_Label_1');
    expect(labelComponents[0].fullyQualifiedName).to.equal('Test_Label_1');
    expect(labelComponents[1].developerName).to.equal('Test_Label_2');
    expect(labelComponents[1].fullyQualifiedName).to.equal('Test_Label_2');
    const customObjs = garbage.deprecatedMembers['CustomObject'];
    expect(customObjs).to.not.be.undefined;
    expect(customObjs.metadataType).to.equal('CustomObject');
    const customObjsComponents = customObjs.components as PackageGarbage[];
    expect(customObjsComponents.length).to.equal(2);
    expect(customObjsComponents[0].developerName).to.equal('Payment');
    expect(customObjsComponents[0].fullyQualifiedName).to.equal('Payment__c');
    expect(customObjsComponents[1].developerName).to.equal('CompanyData');
    expect(customObjsComponents[1].fullyQualifiedName).to.equal('CompanyData__mdt');
  });

  it('package members have custom field > resolves custom field components', async () => {
    // Arrange
    PACKAGE_2_MEMBERS = JSON.parse(
      fs.readFileSync(testDataPath + '/package-members/custom-fields.json', 'utf8')
    ) as QueryResult<Package2Member>;
    const stubMethod = $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords');
    stubMethod.callsFake(fakeFetchRecords);

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const customFields = garbage.deprecatedMembers['CustomField'];
    expect(customFields).to.not.be.undefined;
    expect(customFields.metadataType).to.equal('CustomField');
    const fieldsList = customFields.components as PackageGarbage[];
    expect(fieldsList.length).to.equal(2);
    expect(fieldsList[0].developerName).to.equal('HoursPerDay');
    expect(fieldsList[0].fullyQualifiedName).to.equal('Resource__c.HoursPerDay__c');
    expect(fieldsList[1].developerName).to.equal('HourlyRate');
    expect(fieldsList[1].fullyQualifiedName).to.equal('Resource__c.HourlyRate__c');
  });

  it('package members have quick action > resolves quick action components', async () => {
    // Arrange
    PACKAGE_2_MEMBERS = JSON.parse(
      fs.readFileSync(testDataPath + '/package-members/quick-action.json', 'utf8')
    ) as QueryResult<Package2Member>;
    const stubMethod = $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords');
    stubMethod.callsFake(fakeFetchRecords);

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const quickActions = garbage.deprecatedMembers['QuickActionDefinition'];
    expect(quickActions).to.not.be.undefined;
    expect(quickActions.metadataType).to.equal('QuickAction');
    const fieldsList = quickActions.components as PackageGarbage[];
    expect(fieldsList.length).to.equal(1);
    expect(fieldsList[0].developerName).to.equal('New_ChargePilot_Contract');
    expect(fieldsList[0].fullyQualifiedName).to.equal('Account.New_ChargePilot_Contract');
  });

  it('package members have layouts > resolves layout components', async () => {
    // Arrange
    PACKAGE_2_MEMBERS = JSON.parse(
      fs.readFileSync(testDataPath + '/package-members/layouts.json', 'utf8')
    ) as QueryResult<Package2Member>;
    const stubMethod = $$.SANDBOX.stub(QueryRunner.prototype, 'fetchRecords');
    stubMethod.callsFake(fakeFetchRecords);

    // Act
    const collector = new GarbageCollector(await testOrg.getConnection());
    const garbage = await collector.export();

    // Assert
    const quickActions = garbage.deprecatedMembers['Layout'];
    expect(quickActions).to.not.be.undefined;
    expect(quickActions.metadataType).to.equal('Layout');
    const fieldsList = quickActions.components as PackageGarbage[];
    expect(fieldsList.length).to.equal(3);
    expect(fieldsList[0].fullyQualifiedName).to.equal('ServiceContract-Service Contract Layout');
    expect(fieldsList[1].fullyQualifiedName).to.equal('Pricebook2-Price Book Layout');
    expect(fieldsList[2].fullyQualifiedName).to.equal('OrganizationProfile__c-Organization Profile Layout');
  });

  function fakeFetchRecords<T extends Record>(queryString: string): Promise<Record[]> {
    if (queryString.includes('FROM Package2Member')) {
      return Promise.resolve(PACKAGE_2_MEMBERS.records);
    }
    if (queryString.includes('FROM EntityDefinition WHERE KeyPrefix IN')) {
      return Promise.resolve(ENTITY_DEFINITIONS.records);
    }
    if (queryString.includes('FROM ExternalString WHERE Id IN')) {
      return Promise.resolve(CUSTOM_LABELS.records);
    }
    if (queryString.includes("FROM EntityDefinition WHERE KeyPrefix LIKE 'a%'")) {
      return Promise.resolve(CUSTOM_OBJECT_ENTITY_DEFS.records);
    }
    if (queryString.includes('FROM CustomField WHERE Id IN')) {
      return Promise.resolve(ALL_CUSTOM_FIELDS.records);
    }
    if (queryString.includes('FROM QuickActionDefinition WHERE Id IN')) {
      return Promise.resolve(ALL_QUICK_ACTIONS.records);
    }
    if (queryString.includes('FROM Layout WHERE Id IN')) {
      return Promise.resolve(ALL_LAYOUTS.records);
    }
    return Promise.resolve(new Array<T>());
  }
});
