import { expect } from 'chai';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';

describe('migration plan object', () => {
  it('is initialised with query file => returns string from file', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
      queryFile: 'test/data/soql/accounts.sql',
    });

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    // the file is auto-formatted! Its critical to match exact file formatting for asserts
    // actual validation (syntax, runtime schema, etc) will be performed by the target org
    expect(testObj.getQueryString()).to.equal(
      'SELECT\n  Id,\n  Name,\n  BillingStreet\nFROM\n  Account\nLIMIT\n  9500'
    );
  });

  it('is initialised with query string => returns direct input string', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
      queryString: 'SELECT Id FROM Account',
    });

    // Assert
    expect(testObj.selfCheck()).to.be.true;
    expect(testObj.getQueryString()).to.equal('SELECT Id FROM Account');
  });

  it('is initialised without query or query file => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
    });

    // Act
    expect(testObj.selfCheck()).to.not.be.true;

    // Assert
  });

  it('is initialised with query and query file => is not valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
      queryString: 'SELECT Id FROM Account',
      queryFile: 'test/data/soql/accounts.sql',
    });

    // Act
    expect(testObj.selfCheck()).to.not.be.true;

    // Assert
  });
});
