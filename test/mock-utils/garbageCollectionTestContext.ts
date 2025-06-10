import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { AnyJson } from '@salesforce/ts-types';
import GarbageCollectionMocks from './garbageCollectionMocks.js';

export default class GarbageCollectionTestContext {
  public coreTestContext: TestContext;
  public devHub: MockTestOrgData;
  public targetOrg: MockTestOrgData;
  public apiMocks: GarbageCollectionMocks;

  public constructor() {
    this.coreTestContext = new TestContext();
    this.devHub = new MockTestOrgData();
    this.devHub.isDevHub = true;
    this.targetOrg = new MockTestOrgData();
    this.targetOrg.isDevHub = false;
    this.apiMocks = new GarbageCollectionMocks();
  }

  /**
   * Call this last in `beforeEach` hook to fully init test context and
   * stub all calls with modified variables.
   */
  public async init() {
    this.coreTestContext.fakeConnectionRequest = this.mockQueryResults;
    await this.coreTestContext.stubAuths(this.devHub, this.targetOrg);
  }

  /**
   * Call this in `afterEach` hook to restore all sandboxes and reset
   * all query-result mocks.
   */
  public restore() {
    this.apiMocks = new GarbageCollectionMocks();
    this.coreTestContext.restore();
  }

  private mockQueryResults = (request: AnyJson): Promise<AnyJson> => {
    const url = (request as { url: string }).url;
    if (url.includes(encodeURIComponent('FROM EntityDefinition WHERE KeyPrefix IN ('))) {
      return Promise.resolve(this.apiMocks.ENTITY_DEFINITIONS);
    }
    if (url.includes(encodeURIComponent('FROM EntityDefinition WHERE QualifiedApiName IN ('))) {
      return Promise.resolve(this.apiMocks.FILTERED_ENTITY_DEFINITIONS);
    }
    if (url.includes(encodeURIComponent('FROM Package2 WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.PACKAGE_2);
    }
    if (url.includes(encodeURIComponent('FROM Package2Member WHERE SubjectManageableState IN'))) {
      return Promise.resolve(this.apiMocks.PACKAGE_2_MEMBERS);
    }
    if (url.includes(encodeURIComponent("FROM Package2Member WHERE SubjectKeyPrefix = '300'"))) {
      return Promise.resolve(this.apiMocks.PACKAGED_FLOWS);
    }
    if (url.includes(encodeURIComponent('FROM ExternalString WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.CUSTOM_LABELS);
    }
    if (url.includes(encodeURIComponent("FROM EntityDefinition WHERE KeyPrefix LIKE 'a%'"))) {
      return Promise.resolve(this.apiMocks.CUSTOM_OBJECT_ENTITY_DEFS);
    }
    if (url.includes(encodeURIComponent('FROM CustomField WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.ALL_CUSTOM_FIELDS);
    }
    if (url.includes(encodeURIComponent('FROM QuickActionDefinition WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.ALL_QUICK_ACTIONS);
    }
    if (url.includes(encodeURIComponent('FROM Layout WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.ALL_LAYOUTS);
    }
    if (url.includes(encodeURIComponent("FROM Flow WHERE Status = 'Obsolete'"))) {
      return Promise.resolve(this.apiMocks.OBSOLETE_FLOW_VERSIONS);
    }
    if (url.includes(encodeURIComponent('FROM CompanyData__mdt'))) {
      return Promise.resolve(this.apiMocks.M00_CMDS);
    }
    if (url.includes(encodeURIComponent('FROM HandlerControl__mdt'))) {
      return Promise.resolve(this.apiMocks.M01_CMDS);
    }
    if (url.includes(encodeURIComponent('FROM WorkflowAlert WHERE Id IN'))) {
      return Promise.resolve(this.apiMocks.WORKFLOW_ALERTS);
    }
    if (url.includes(encodeURIComponent("FROM WorkflowFieldUpdate WHERE Id = '04Y0X0000000gb0UAA'"))) {
      return Promise.resolve(this.apiMocks.WORKFLOW_FIELD_UPDATES);
    }
    if (url.includes(encodeURIComponent('FROM SubscriberPackage WHERE Id ='))) {
      return Promise.resolve(this.apiMocks.SUBSCRIBER_PACKAGE);
    }
    throw new Error(`Request not mocked: ${JSON.stringify(request)}`);
  };
}
