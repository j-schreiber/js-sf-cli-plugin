import { expect } from 'chai';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';

describe('migration plan object', () => {
  it('is initialised with query file => is valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
      queryFile: 'soql/accounts.sql',
    });

    // Assert
    expect(testObj.selfCheck()).to.be.true;
  });

  it('is initialised with query string => is valid', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject({
      objectName: 'Account',
      queryString: 'SELECT Id FROM Account',
    });

    // Assert
    expect(testObj.selfCheck()).to.be.true;
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
      queryFile: 'soql/accounts.sql',
    });

    // Act
    expect(testObj.selfCheck()).to.not.be.true;

    // Assert
  });
});
