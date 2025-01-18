import fs from 'node:fs';
import { expect } from 'chai';
import sinon from 'sinon';
import { type AnyJson } from '@salesforce/ts-types';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { DescribeSObjectResult } from '@jsforce/jsforce-node';
import MigrationPlanObject from '../../src/common/migrationPlanObject.js';
import { mockDescribeResults, MockOrderDescribeResult } from '../data/describes/mockDescribeResults.js';
import {
  EmptyQueryResult,
  GenericSuccess,
  InvalidFieldInQuery,
  MockAccounts,
  MockOrders,
} from '../data/api/queryResults.js';
import { LOCAL_CACHE_DIR } from '../../src/common/constants.js';
import PlanCache from '../../src/common/planCache.js';
import QueryBuilder from '../../src/common/utils/queryBuilder.js';
import { eventBus } from '../../src/common/comms/eventBus.js';
import { mockQueryResponseWithQueryMore } from '../mock-utils/sfQueryApiMocks.js';
import DescribeApi from '../../src/common/metadata/describeApi.js';

const TooManyQuerySourcesDefined: string =
  'More than one query provided. queryString OR queryFile or queryObject are allowed.';
const NoQueryDefinedForAccount: string = 'No query defined for: Account';
const ExportPath: string = 'tmp/tests/migration-plan-obj-tests';

describe('migration plan object', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    sinon.stub(DescribeApi.prototype, 'describeSObject').callsFake(mockDescribeResults);
    // sinon
    //   .stub(MigrationPlanObject.prototype, 'describeObject')
    //   .resolves(MockAccountDescribeResult as DescribeSObjectResult);
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
    sinon.restore();
    // better to stub the describeAPI entirely
    fs.rmSync(`./${LOCAL_CACHE_DIR}/${testOrg.username}`, { recursive: true, force: true });
    fs.rmSync(ExportPath, { recursive: true, force: true });
    PlanCache.flush();
  });

  it('has only query file => returns string from file', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Assert
    // the file is auto-formatted! Query builder replaces all formatting with single whitespace
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
  });

  it('has only query string => returns direct input string', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
      },
      await testOrg.getConnection()
    );
    // don't load, because describe API is not stubbed
    // await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id FROM Account');
  });

  it('has no query defined => loading fails', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
      },
      await testOrg.getConnection()
    );

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(NoQueryDefinedForAccount);
    }
  });

  it('is has query and query file => loading fails', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(TooManyQuerySourcesDefined);
    }
  });

  it('is has full query object with "all" fields => creates SOQL from describe', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, filter: "Account.CurrencyIsoCode = 'EUR'", limit: 10_000 },
      },
      await testOrg.getConnection()
    );
    sinon.restore();
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal(
      "SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order WHERE Account.CurrencyIsoCode = 'EUR' LIMIT 10000"
    );
  });

  it('is has query object without filter => creates SOQL without WHERE', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true },
      },
      await testOrg.getConnection()
    );
    sinon.restore();
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
  });

  it('is has query object with limit => creates SOQL with LIMIT', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, limit: 1000 },
      },
      await testOrg.getConnection()
    );
    sinon.restore();
    sinon
      .stub(MigrationPlanObject.prototype, 'describeObject')
      .resolves(MockOrderDescribeResult as DescribeSObjectResult);

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal(
      'SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order LIMIT 1000'
    );
  });

  it('has invalid query string syntax => loading fails', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.reject(InvalidFieldInQuery);
      }
      return Promise.reject({ errorCode: 'UNEXPECTED_REJECT_WRONG_REQUEST' });
    };
    const queryInput = 'SELECT Id,InvalidField__x FROM Account';
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: queryInput,
      },
      await testOrg.getConnection()
    );

    // Act
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(queryInput);
    }
  });

  it('has invalid query string with LIMIT => loading fails', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CInvalidField__x%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve(GenericSuccess);
      }
      return Promise.reject('Unexpected query was executed');
    };
    const queryInput = 'SELECT Id,InvalidField__x FROM Account LIMIT 100';
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: queryInput,
      },
      await testOrg.getConnection()
    );

    // Assert
    try {
      await testObj.load();
    } catch (err) {
      expect(String(err)).to.contain(queryInput);
    }
  });

  it('has complex query from file => query successfully validated during load', async () => {
    // Arrange
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      expect(url).to.include('LIMIT%201', 'Did not normalise query to LIMIT 1');
      if (url.includes('query?q=SELECT%20Id%2CName%2CBillingStreet%20FROM%20Account%20LIMIT%201')) {
        return Promise.resolve(GenericSuccess);
      }
      return Promise.reject({ data: { message: 'Unexpected query was executed' } });
    };
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );

    // Act
    await testObj.load();

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
  });

  it('fails to load when invalid field is specified for export', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
        exports: { Id: 'myAccIds', CreatedDate: 'dateExport' },
      },
      await testOrg.getConnection()
    );

    // Act
    try {
      await testObj.load();
      expect.fail('Expected to throw an exception, but succeeded');
    } catch (err) {
      if (err instanceof SfError) {
        expect(err.name).to.equal('InvalidPlanFileSyntax');
        expect(err.message).to.equal(
          'Exported field CreatedDate has invalid type: datetime. Valid types are: id,reference,int,string'
        );
      } else {
        expect.fail('Expected SfError, but got: ' + JSON.stringify(err));
      }
    }

    // Assert
    expect(testObj.resolveQueryString()).to.equal('SELECT Id,Name,BillingStreet FROM Account LIMIT 9500');
  });

  it('retrieves records from query and exports ids > exports all ids to cache', async () => {
    // Arrange
    mockQueryResults(MockAccounts, 'query');
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
        exports: { Id: 'myAccountIds' },
      },
      await testOrg.getConnection()
    );
    await testObj.load();

    // Act
    const result = await testObj.retrieveRecords(ExportPath);

    // Assert
    expect(result.totalSize).to.equal(4);
    expect(PlanCache.isSet('myAccountIds')).to.be.true;
    expect(PlanCache.get('myAccountIds')).deep.equals([
      '0019Q00000eC8UKQA0',
      '0019Q00000eDKbNQAW',
      '0019Q00000eDKbOQAW',
      '0019Q00000eDKbPQAW',
    ]);
  });

  it('retrieves records and does not specify export > no ids exported to cache', async () => {
    // Arrange
    mockQueryResults(MockAccounts, 'query');
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryFile: 'test/data/soql/accounts.sql',
      },
      await testOrg.getConnection()
    );
    await testObj.load();

    // Act
    const result = await testObj.retrieveRecords(ExportPath);

    // Assert
    expect(result.totalSize).to.equal(4);
    expect(PlanCache.isSet('myAccountIds')).to.be.false;
  });

  it('retrieves records with parent bind > includes parent select in query', async () => {
    // Arrange
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, bind: { field: 'AccountId', variable: 'mockedAccountIds' } },
      },
      await testOrg.getConnection()
    );
    await testObj.load();
    sinon.stub(QueryBuilder.prototype, 'assertSyntax').resolves(true);
    PlanCache.push('mockedAccountIds', ['0019Q00000eC8UKQA0']);

    // Act
    mockQueryResults(MockOrders, 'WHERE%20AccountId%20IN%20(');
    const result = await testObj.retrieveRecords(ExportPath);

    // Assert
    expect(result.totalSize).to.equal(1);
  });

  it('retrieves records with parent bind > parent result was empty > child object has empty IN filter', async () => {
    // Arrange
    mockQueryResults(EmptyQueryResult.records, 'query');
    const accPlanObject: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Account',
        queryString: 'SELECT Id FROM Account',
        exports: { Id: 'myAccountIds' },
      },
      await testOrg.getConnection()
    );
    await accPlanObject.load();
    const accRetrieveResult = await accPlanObject.retrieveRecords(ExportPath);
    expect(accRetrieveResult.executedFullQueryStrings.length).to.equal(1);
    expect(accRetrieveResult.executedFullQueryStrings[0]).to.equal('SELECT Id FROM Account');

    // Act
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, bind: { field: 'AccountId', variable: 'myAccountIds' } },
      },
      await testOrg.getConnection()
    );
    await testObj.load();
    sinon.stub(QueryBuilder.prototype, 'assertSyntax').resolves(true);
    const result = await testObj.retrieveRecords(ExportPath);

    // Assert
    expect(PlanCache.isSet('myAccountIds')).to.be.true;
    expect(PlanCache.get('myAccountIds')).deep.equals([]);
    expect(result.queryString).to.equal('SELECT Id,OrderNumber,AccountId,BillToContactId FROM Order');
    expect(result.totalSize).to.equal(0);
    expect(result.executedFullQueryStrings.length).to.equal(0);
  });

  it('retrieves records with multiple parent batches and emits useful status information', async () => {
    // Arrange
    PlanCache.CHUNK_SIZE = 2;
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        query: { fetchAllFields: true, bind: { field: 'AccountId', variable: 'mockedAccountIds' } },
      },
      await testOrg.getConnection()
    );
    await testObj.load();
    sinon.stub(QueryBuilder.prototype, 'assertSyntax').resolves(true);
    PlanCache.set('mockedAccountIds', [
      '0019Q00000eC8UKQA0',
      '0019Q00000eDKbNQAW',
      '0019Q00000eDKbOQAW',
      '0019Q00000eDKbPQAW',
    ]);
    const statusListener = sinon.stub();
    eventBus.addListener('planObjectStatus', statusListener);

    // Act
    $$.fakeConnectionRequest = mockQueryResponseWithQueryMore;
    await testObj.retrieveRecords(ExportPath);

    // Assert
    // 1 event to init, then 1 events per batch (2 batches)
    // expect(statusListener.callCount).equals(5);
    expect(statusListener.args[0][0]).contains({ message: 'Fetching records in 2 chunks of 2 parent ids each' });
    expect(statusListener.args[1][0]).contains({ message: 'Processing chunk 1 of 2: 1st request' });
    expect(statusListener.args[2][0]).contains({ message: 'Processing chunk 1 of 2: 2/2 requests' });
    expect(statusListener.args[3][0]).contains({ message: 'Processing chunk 2 of 2: 1st request' });
    expect(statusListener.args[4][0]).contains({ message: 'Processing chunk 2 of 2: 2/2 requests' });
  });

  it('retrieves records and exports multiple ids > exports all ids to cache', async () => {
    // Arrange
    $$.fakeConnectionRequest = mockQueryResponseWithQueryMore;

    // Act
    const testObj: MigrationPlanObject = new MigrationPlanObject(
      {
        objectName: 'Order',
        queryString: 'SELECT Id,AccountId,BillToContactId FROM Order',
        exports: { Id: 'orderIds', AccountId: 'accountIds', BillToContactId: 'billingContactIds' },
      },
      await testOrg.getConnection()
    );
    await testObj.load();
    const result = await testObj.retrieveRecords(ExportPath);

    // Assert
    expect(result.totalSize).to.equal(40);
    expect(PlanCache.isSet('orderIds')).to.be.true;
    expect(PlanCache.isSet('accountIds')).to.be.true;
    expect(PlanCache.isSet('billingContactIds')).to.be.true;
    expect(PlanCache.getNullSafe('orderIds').length).to.equal(40);
    expect(PlanCache.getNullSafe('accountIds').length).to.equal(20);
    expect(PlanCache.getNullSafe('billingContactIds').length).to.equal(2);
  });

  function mockQueryResults(mockResult: AnyJson, expectedUriString: string) {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const url = (request as { url: string }).url;
      if (url.includes(expectedUriString)) {
        return Promise.resolve({
          totalSize: (mockResult as unknown[]).length,
          records: mockResult,
          done: true,
        });
      }
      return Promise.reject({ data: { message: 'Unexpected query was executed' } });
    };
  }
});
