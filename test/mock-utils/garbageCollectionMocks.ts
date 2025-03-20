import fs from 'node:fs';
import path from 'node:path';
import { QueryResult, Record } from '@jsforce/jsforce-node';
import {
  EntityDefinition,
  FieldDefinition,
  FlowVersionDefinition,
  NamedRecord,
  Package2,
  Package2Member,
  SubscriberPackage,
  WorkflowAlertEntity,
} from '../../src/types/sfToolingApiTypes.js';
import { PackageGarbageResult } from '../../src/garbage-collection/packageGarbageTypes.js';

const testDataPath = path.join('test', 'data', 'garbage-collection');

export default class GarbageCollectionMocks {
  public PACKAGE_2 = parseMockResult<Package2>('package-2.json');
  public PACKAGE_2_MEMBERS = parseMockResult<Package2Member>('package-members/mixed.json');
  public PACKAGED_FLOWS = parseMockResult<Package2Member>('packaged-flows.json');
  public OBSOLETE_FLOW_VERSIONS = parseMockResult<FlowVersionDefinition>('outdated-flow-versions.json');
  public ENTITY_DEFINITIONS = parseMockResult<EntityDefinition>('entity-definitions.json');
  public CUSTOM_LABELS = parseMockResult<NamedRecord>('custom-labels.json');
  public CUSTOM_OBJECT_ENTITY_DEFS = parseMockResult<NamedRecord>('custom-object-entity-defs.json');
  public ALL_CUSTOM_FIELDS = parseMockResult<FieldDefinition>('all-custom-fields.json');
  public ALL_QUICK_ACTIONS = parseMockResult<FieldDefinition>('all-quick-actions.json');
  public ALL_LAYOUTS = parseMockResult<FieldDefinition>('layouts.json');
  public M00_CMDS = parseMockResult<FieldDefinition>('cmd-m00-records.json');
  public M01_CMDS = parseMockResult<FieldDefinition>('cmd-m01-records.json');
  public WORKFLOW_ALERTS = parseMockResult<WorkflowAlertEntity>('workflow-alert-definitions.json');
  public WORKFLOW_FIELD_UPDATES = parseMockResult<WorkflowAlertEntity>('workflow-field-update-defs.json');
  public SUBSCRIBER_PACKAGE = parseMockResult<SubscriberPackage>('subscriber-package.json');

  public fetchRecordsStub<T extends Record>(queryString: string): Promise<Record[]> {
    if (queryString.includes('FROM Package2 WHERE Id IN')) {
      return Promise.resolve(this.PACKAGE_2.records);
    }
    if (queryString.includes('FROM Package2Member WHERE SubjectManageableState IN')) {
      return Promise.resolve(this.PACKAGE_2_MEMBERS.records);
    }
    if (queryString.includes("FROM Package2Member WHERE SubjectKeyPrefix = '300'")) {
      return Promise.resolve(this.PACKAGED_FLOWS.records);
    }
    if (queryString.includes('FROM EntityDefinition WHERE KeyPrefix IN')) {
      return Promise.resolve(this.ENTITY_DEFINITIONS.records);
    }
    if (queryString.includes('FROM ExternalString WHERE Id IN')) {
      return Promise.resolve(this.CUSTOM_LABELS.records);
    }
    if (queryString.includes("FROM EntityDefinition WHERE KeyPrefix LIKE 'a%'")) {
      return Promise.resolve(this.CUSTOM_OBJECT_ENTITY_DEFS.records);
    }
    if (queryString.includes('FROM CustomField WHERE Id IN')) {
      return Promise.resolve(this.ALL_CUSTOM_FIELDS.records);
    }
    if (queryString.includes('FROM QuickActionDefinition WHERE Id IN')) {
      return Promise.resolve(this.ALL_QUICK_ACTIONS.records);
    }
    if (queryString.includes('FROM Layout WHERE Id IN')) {
      return Promise.resolve(this.ALL_LAYOUTS.records);
    }
    if (queryString.includes("FROM Flow WHERE Status = 'Obsolete'")) {
      return Promise.resolve(this.OBSOLETE_FLOW_VERSIONS.records);
    }
    if (queryString.includes('FROM CompanyData__mdt')) {
      return Promise.resolve(this.M00_CMDS.records);
    }
    if (queryString.includes('FROM HandlerControl__mdt')) {
      return Promise.resolve(this.M01_CMDS.records);
    }
    if (queryString.includes('FROM WorkflowAlert WHERE Id IN')) {
      return Promise.resolve(this.WORKFLOW_ALERTS.records);
    }
    if (queryString.includes("FROM WorkflowFieldUpdate WHERE Id = '04Y0X0000000gb0UAA'")) {
      return Promise.resolve(this.WORKFLOW_FIELD_UPDATES.records);
    }
    if (queryString.includes('FROM SubscriberPackage WHERE Id =')) {
      return Promise.resolve(this.SUBSCRIBER_PACKAGE.records);
    }
    return Promise.resolve(new Array<T>());
  }
}

export const EXPECTED_E2E_GARBAGE = JSON.parse(
  fs.readFileSync(path.join('test', 'data', 'garbage-collection', 'expected-garbage-NUTs.json'), 'utf8')
) as PackageGarbageResult;

export function parseMockResult<T extends Record>(filePath: string) {
  return JSON.parse(fs.readFileSync(`${path.join(testDataPath, filePath)}`, 'utf8')) as QueryResult<T>;
}
