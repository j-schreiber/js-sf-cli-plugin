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
import { EntityDefinition, NamedRecord, Package2Member } from '../../src/types/sfToolingApiTypes.js';
import { PackageGarbage } from '../../src/garbage-collection/packageGarbage.js';

const PACKAGE_2_MEMBERS = JSON.parse(
  fs.readFileSync('test/data/api/package-members.json', 'utf8')
) as QueryResult<Package2Member>;
const ENTITY_DEFINITIONS = JSON.parse(
  fs.readFileSync('test/data/api/entity-definitions.json', 'utf8')
) as QueryResult<EntityDefinition>;
const CUSTOM_LABELS = JSON.parse(
  fs.readFileSync('test/data/api/custom-labels.json', 'utf8')
) as QueryResult<NamedRecord>;
const CUSTOM_OBJECT_ENTITY_DEFS = JSON.parse(
  fs.readFileSync('test/data/api/custom-object-entity-defs.json', 'utf8')
) as QueryResult<NamedRecord>;

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
    const labelComponents = labels.components as PackageGarbage[];
    expect(labelComponents.length).to.equal(2);
    expect(labelComponents[0].developerName).to.equal('Test_Label_1');
    expect(labelComponents[0].fullyQualifiedName).to.equal('Test_Label_1');
    expect(labelComponents[1].developerName).to.equal('Test_Label_2');
    expect(labelComponents[1].fullyQualifiedName).to.equal('Test_Label_2');
    const customObjs = garbage.deprecatedMembers['CustomObject'];
    expect(customObjs).to.not.be.undefined;
    const customObjsComponents = customObjs.components as PackageGarbage[];
    expect(customObjsComponents.length).to.equal(2);
    expect(customObjsComponents[0].developerName).to.equal('Payment');
    expect(customObjsComponents[0].fullyQualifiedName).to.equal('Payment__c');
    expect(customObjsComponents[1].developerName).to.equal('CompanyData');
    expect(customObjsComponents[1].fullyQualifiedName).to.equal('CompanyData__mdt');
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
    return Promise.resolve(new Array<T>());
  }
});
