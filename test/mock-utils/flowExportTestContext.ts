import fs from 'node:fs';
import path from 'node:path';
import { Record } from '@jsforce/jsforce-node';
import { AnyJson } from '@salesforce/ts-types';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { XMLParser } from 'fast-xml-parser';
import { FlowVersionDefinition } from '../../src/types/sfToolingApiTypes.js';
import { OBSOLETE_FLOW_VERSIONS, UNUSED_FLOW_VERSIONS } from '../../src/common/flowExporter.js';
import { PackageManifest } from '../../src/common/packageManifestBuilder.js';

export default class FlowExportTestContext {
  public coreContext: TestContext;
  public testTargetOrg: MockTestOrgData;
  public unusedFlows: FlowVersionDefinition[] = [];
  public obsoleteFlows: FlowVersionDefinition[] = [];
  public outputDir = path.join('tmp', 'flow-export');

  public constructor() {
    this.coreContext = new TestContext();
    this.testTargetOrg = new MockTestOrgData();
  }

  public async init() {
    this.coreContext.fakeConnectionRequest = this.mockQueryResults;
  }

  public restore() {
    this.coreContext.restore();
    this.unusedFlows = [];
    this.obsoleteFlows = [];
    fs.rmSync(this.outputDir, { recursive: true, force: true });
  }

  public readonly mockQueryResults = (request: AnyJson): Promise<AnyJson> => {
    const url = (request as { url: string }).url;
    if (url.includes(encodeURIComponent(OBSOLETE_FLOW_VERSIONS))) {
      return Promise.resolve({ done: true, records: this.obsoleteFlows, totalRecords: this.obsoleteFlows.length });
    }
    if (url.includes(encodeURIComponent(UNUSED_FLOW_VERSIONS))) {
      return Promise.resolve({ done: true, records: this.unusedFlows, totalRecords: this.unusedFlows.length });
    }
    return Promise.reject(new Error(`No mock was defined for: ${JSON.stringify(request)}`));
  };
}

/**
 * Expects a JSON file with a list of records - NOT a QueryResult (as other mock results)
 *
 * @param filePath
 * @returns
 */
export function parseMockResult<T extends Record>(filePath: string): T[] {
  return JSON.parse(fs.readFileSync(path.join('test', 'data', 'flow-export', filePath), 'utf8')) as T[];
}

export function parsePackageXml(filePath: string): PackageManifest {
  const xmlContents = fs.readFileSync(filePath, 'utf-8');
  // options "isArray" ensures, that "types" is always parsed as list,
  // even if only one entry exists
  return new XMLParser({ isArray: (name, jpath) => jpath === 'Package.types' }).parse(xmlContents) as PackageManifest;
}
