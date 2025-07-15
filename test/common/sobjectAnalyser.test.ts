import { expect } from 'chai';
import FieldUsageTestContext from '../mock-utils/fieldUsageTestContext.js';
import SObjectAnalyser from '../../src/field-usage/sobjectAnalyser.js';
import { FieldUsageStats, SObjectAnalysisResult } from '../../src/field-usage/fieldUsageTypes.js';

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
    $$.init();
  });

  afterEach(() => {
    $$.restore();
  });

  it('analyses field usage without options of a valid sobject name for each filterable field', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage();
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(11);
    expect(fieldUsageResult.analysedFields).to.include.deep.members([
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
        name: 'RecordTypeId',
        type: 'reference',
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
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    // 1 custom field is not filterable
    expect(fieldUsageResult.analysedFields.length).to.equal($$.getFilterableCustomFieldCount('Account'));
    expect(fieldUsageResult.analysedFields[0]).to.include(EXPECTED_STRING_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[1]).to.include(EXPECTED_FORMULA_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[2]).to.include(EXPECTED_CHECKBOX_FIELD_OUTPUT);
  });

  it('analyses usage for each record type with segment record types flag', async () => {
    // Arrange
    $$.queryResults[
      "SELECT COUNT() FROM Account WHERE RecordTypeId = '012000000000001AAA' AND MyCustomField__c != NULL"
    ] = 10;
    $$.queryResults[
      "SELECT COUNT() FROM Account WHERE RecordTypeId = '012000000000002AAA' AND MyCustomField__c != NULL"
    ] = 15;
    $$.queryResults[
      "SELECT COUNT() FROM Account WHERE (RecordTypeId = '012000000000000AAA' OR RecordTypeId = NULL)"
    ] = 0;
    $$.queryResults["SELECT COUNT() FROM Account WHERE RecordTypeId = '012000000000001AAA'"] = 20;
    $$.queryResults["SELECT COUNT() FROM Account WHERE RecordTypeId = '012000000000002AAA'"] = 30;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({ segmentRecordTypes: true });

    // Assert
    expect(Object.keys(analyseResult.recordTypes)).to.deep.equal(['Master', 'Test_Type_1', 'Test_Type_2']);
    expect(analyseResult.recordTypes.Master.totalRecords).to.equal(0);
    expect(analyseResult.recordTypes.Test_Type_1.totalRecords).to.equal(20);
    expect(analyseResult.recordTypes.Test_Type_2.totalRecords).to.equal(30);
  });

  it('analyses record type specific defaults with segmentRecordTypes and checkDefaults', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({ segmentRecordTypes: true, checkDefaultValues: true });

    // Assert
    expect(findField(analyseResult, 'Master', 'MyPicklist__c')?.defaultValue).to.equal('Default');
    expect(findField(analyseResult, 'Master', 'MyPicklist2__c')?.defaultValue).to.equal('Default 2');
    expect(findField(analyseResult, 'Master', 'MyCheckbox__c')?.defaultValue).to.equal(true);
    expect(findField(analyseResult, 'Test_Type_1', 'MyPicklist__c')?.defaultValue).to.equal('RT Default');
    expect(findField(analyseResult, 'Test_Type_1', 'MyPicklist2__c')?.defaultValue).to.equal(undefined);
    expect(findField(analyseResult, 'Test_Type_1', 'MyCheckbox__c')?.defaultValue).to.equal(true);
  });

  it('excludes formula fields when flag is set', async () => {
    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
    });
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal(
      $$.getFilterableCustomFieldCount('Account') - $$.getFormulaFieldCount('Account')
    );
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
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal($$.getFilterableCustomFieldCount('Account'));
    expect(fieldUsageResult.analysedFields[0]).to.include(EXPECTED_STRING_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[1]).to.include(EXPECTED_FORMULA_FIELD_OUTPUT);
    expect(fieldUsageResult.analysedFields[2]).to.include(EXPECTED_CHECKBOX_FIELD_OUTPUT);
  });

  it('runs defaults check when option is true for fields with defaults', async () => {
    // Arrange
    $$.queryResults["SELECT COUNT() FROM Account WHERE MyCustomField__c != NULL AND MyCustomField__c != 'Test'"] = 0;
    $$.queryResults['SELECT COUNT() FROM Account WHERE MyCheckbox__c != NULL AND MyCheckbox__c != true'] = 20;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
      checkDefaultValues: true,
    });
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    const expectedCount = $$.getFilterableCustomFieldCount('Account') - $$.getFormulaFieldCount('Account');
    expect(fieldUsageResult.analysedFields.length).to.equal(expectedCount);
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

  it('runs history checks when option is true for fields with history tracking', async () => {
    // Arrange
    $$.queryResults['SELECT COUNT() FROM Account WHERE MyCustomField__c != NULL'] = 0;
    $$.queryResults['SELECT COUNT() FROM Account WHERE MyCheckbox__c != NULL'] = 20;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      excludeFormulaFields: true,
      customFieldsOnly: true,
      checkHistory: true,
    });
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    const expectedCount = $$.getFilterableCustomFieldCount('Account') - $$.getFormulaFieldCount('Account');
    expect(fieldUsageResult.analysedFields.length).to.equal(expectedCount);
    expect(fieldUsageResult.analysedFields[0]).to.include({
      name: 'MyCustomField__c',
      type: 'string',
      absolutePopulated: 0,
      percentagePopulated: 0,
      histories: 1,
      lastUpdated: '2025-07-05',
    });
    expect(fieldUsageResult.analysedFields[1]).to.include({
      name: 'MyCheckbox__c',
      type: 'boolean',
      absolutePopulated: 20,
      percentagePopulated: 0.2,
      histories: 1,
      lastUpdated: '2025-07-05',
    });
  });

  it('does not run default checks when option is omitted', async () => {
    // Arrange
    $$.queryResults['SELECT COUNT() FROM Account WHERE MyCustomField__c != NULL'] = 10;
    $$.queryResults['SELECT COUNT() FROM Account WHERE Formula__c != NULL'] = 20;
    $$.queryResults['SELECT COUNT() FROM Account WHERE MyCheckbox__c != NULL'] = 30;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      customFieldsOnly: true,
    });
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    expect(fieldUsageResult.analysedFields.length).to.equal($$.getFilterableCustomFieldCount('Account'));
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

  it('shows optional attributes in analysed fields when object has no records', async () => {
    // Arrange
    $$.queryResults['SELECT COUNT() FROM Account'] = 0;

    // Act
    const anal = await SObjectAnalyser.create(await $$.testTargetOrg.getConnection(), 'Account');
    const analyseResult = await anal.analyseFieldUsage({
      checkHistory: true,
      checkDefaultValues: true,
    });
    const fieldUsageResult = analyseResult.recordTypes.Master;

    // Assert
    fieldUsageResult.analysedFields.forEach((field) => {
      expect(Object.keys(field)).to.include.deep.members([
        'name',
        'type',
        'absolutePopulated',
        'defaultValue',
        'histories',
        'lastUpdated',
      ]);
    });
  });
});

function findField(result: SObjectAnalysisResult, recordType: string, fieldName: string): FieldUsageStats | undefined {
  if (!result.recordTypes[recordType]) {
    return undefined;
  }
  for (const af of result.recordTypes[recordType].analysedFields) {
    if (af.name === fieldName) {
      return af;
    }
  }
  return undefined;
}
