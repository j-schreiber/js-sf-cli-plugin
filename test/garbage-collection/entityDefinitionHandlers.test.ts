import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { loadHandlers } from '../../src/garbage-collection/entity-handlers/index.js';

describe('entity definition handlers', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  it('loads all handlers and exports as record', async () => {
    // Act
    const handlers = loadHandlers(await testOrg.getConnection());

    // Assert
    expect(handlers['ExternalString']).to.not.be.undefined;
  });
});
