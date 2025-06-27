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
    const anal = await SObjectAnalyser.init(await $$.testTargetOrg.getConnection(), 'Account');
    const fieldUsageResult = await anal.analyseFieldUsage();

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(7);
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
      {
        name: 'Formula__c',
        type: 'formula (string)',
        absolutePopulated: 100,
        percentagePopulated: 1,
      },
    ]);
  });

  it('analyses field usage with custom fields only for only custom fields', async () => {
    // Act
    const anal = await SObjectAnalyser.init(await $$.testTargetOrg.getConnection(), 'Account');
    const fieldUsageResult = await anal.analyseFieldUsage({ customFieldsOnly: true });

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(2);
    expect(fieldUsageResult.fields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
    expect(fieldUsageResult.fields[1]).to.include({
      name: 'Formula__c',
      type: 'formula (string)',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
  });

  it('excludes formula fields when flag is set', async () => {
    // Act
    const anal = await SObjectAnalyser.init(await $$.testTargetOrg.getConnection(), 'Account');
    const fieldUsageResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
    });

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(1);
    expect(fieldUsageResult.fields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
  });

  it('includes formula fields when exclude flag is explicitly set as false', async () => {
    // Act
    const anal = await SObjectAnalyser.init(await $$.testTargetOrg.getConnection(), 'Account');
    const fieldUsageResult = await anal.analyseFieldUsage({
      excludeFormulaFields: false,
      customFieldsOnly: true,
    });

    // Assert
    expect(fieldUsageResult.fields.length).to.equal(2);
    expect(fieldUsageResult.fields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
    expect(fieldUsageResult.fields[1]).to.include({
      name: 'Formula__c',
      type: 'formula (string)',
      absolutePopulated: 100,
      percentagePopulated: 1,
    });
  });
});
