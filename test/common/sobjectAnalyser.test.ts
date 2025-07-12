import { expect } from 'chai';
import FieldUsageTestContext from '../mock-utils/fieldUsageTestContext.js';
import SObjectAnalyser from '../../src/field-usage/sobjectAnalyser.js';

const EXPECTED_STRING_FIELD_OUTPUT = {
  name: 'MyCustomField__c',
  type: 'string',
  absolutePopulated: 100,
  percentagePopulated: 1,
};
const EXPECTED_CHECKBOX_FIELD_OUTPUT = {
  name: 'MyCheckbox__c',
  type: 'boolean',
  absolutePopulated: 100,
  percentagePopulated: 1,
};
const EXPECTED_FORMULA_FIELD_OUTPUT = {
  name: 'Formula__c',
  type: 'formula (string)',
  absolutePopulated: 100,
  percentagePopulated: 1,
};

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
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage();
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(8);
    expect(fieldUsageResult.analysedFields).to.have.deep.members([
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
      EXPECTED_STRING_FIELD_OUTPUT,
      EXPECTED_FORMULA_FIELD_OUTPUT,
      EXPECTED_CHECKBOX_FIELD_OUTPUT,
    ]);
  });

  it('analyses field usage with custom fields only for only custom fields', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({ customFieldsOnly: true });
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(3);
    expect(fieldUsageResult.analysedFields[0]).to.include(EXPECTED_STRING_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[1]).to.include(EXPECTED_FORMULA_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[2]).to.include(EXPECTED_CHECKBOX_FIELD_OUTPUT);
  });

  it('excludes formula fields when flag is set', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
    });
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(2);
    expect(fieldUsageResult.analysedFields[0]).to.include(EXPECTED_STRING_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[1]).to.include(EXPECTED_CHECKBOX_FIELD_OUTPUT);
  });

  it('includes formula fields when exclude flag is explicitly set as false', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: false,
      customFieldsOnly: true,
    });
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(3);
    expect(fieldUsageResult.analysedFields[0]).to.include(EXPECTED_STRING_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[1]).to.include(EXPECTED_FORMULA_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[2]).to.include(EXPECTED_CHECKBOX_FIELD_OUTPUT);
  });

  it('runs defaults check when option is true for fields with defaults', async () => {
    // Arrange
    $$.queryResults["SELECT COUNT(Id) FROM Account WHERE MyCustomField__c != NULL AND MyCustomField__c != 'Test'"] = 0;
    $$.queryResults['SELECT COUNT(Id) FROM Account WHERE MyCheckbox__c != NULL AND MyCheckbox__c != true'] = 20;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
      checkDefaultValues: true,
    });
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(2);
    expect(fieldUsageResult.analysedFields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 0,
      percentagePopulated: 0,
      defaultValue: 'Test',
    });
    expect(fieldUsageResult.analysedFields[1]).to.include({
      name: 'MyCheckbox__c',
      type: 'boolean',
      absolutePopulated: 20,
      percentagePopulated: 0.2,
      defaultValue: true,
    });
  });

  it('does not run default checks when option is omitted', async () => {
    // Arrange
    $$.queryResults['SELECT COUNT(Id) FROM Account WHERE MyCustomField__c != NULL'] = 10;
    $$.queryResults['SELECT COUNT(Id) FROM Account WHERE Formula__c != NULL'] = 20;
    $$.queryResults['SELECT COUNT(Id) FROM Account WHERE MyCheckbox__c != NULL'] = 30;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      customFieldsOnly: true,
    });
    const fieldUsageResult = analyseResult.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(3);
    expect(fieldUsageResult.analysedFields[0]).to.include({
      name: 'MyCustomField__c',
      absolutePopulated: 10,
    });
    expect(fieldUsageResult.analysedFields[1]).to.include({
      name: 'Formula__c',
      absolutePopulated: 20,
    });
    expect(fieldUsageResult.analysedFields[2]).to.include({
      name: 'MyCheckbox__c',
      absolutePopulated: 30,
    });
  });
});
