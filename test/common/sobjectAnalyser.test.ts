import { expect } from 'chai';
import FieldUsageTestContext from '../mock-utils/fieldUsageTestContext.js';
import SObjectAnalyser from '../../src/field-usage/sobjectAnalyser.js';

describe('sobject analyser', () => {
  const $$ = new FieldUsageTestContext();

  beforeEach(async () => {
    await $$.init();
  });

  afterEach(() => {
    $$.restore();
  });

  it('analyses field usage without options of a valid sobject name for each filterable field', async () => {
    // Act
    const anal = new SObjectAnalyser(await $$.testTargetOrg.getConnection());
    const fieldUsageResult = await anal.analyseFieldUsage('Account');

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(6);
    expect(fieldUsageResult.fields).to.have.deep.members([
      {
        name: 'Id',
        type: 'id',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
      {
        name: 'Name',
        type: 'string',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
      {
        name: 'AccountNumber',
        type: 'string',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
      {
        name: 'CreatedDate',
        type: 'datetime',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
      {
        name: 'BillingStreet',
        type: 'textarea',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
      {
        name: 'MyCustomField__c',
        type: 'string',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
    ]);
  });

  it('analyses field usage with custom fields only for only custom fields', async () => {
    // Act
    const anal = new SObjectAnalyser(await $$.testTargetOrg.getConnection());
    const fieldUsageResult = await anal.analyseFieldUsage('Account', { customFieldsOnly: true });

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(1);
    expect(fieldUsageResult.fields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
  });
});
