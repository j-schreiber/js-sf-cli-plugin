import { Connection, Messages } from '@salesforce/core';
import { EntityDefinitionHandler, EntityDefinitionIgnorer } from '../entityDefinitionHandler.js';
import { CustomObject } from './customObject.js';
import { DeveloperNameEntity } from './developerNameEntity.js';
import { UnsupportedEntity } from './unsupportedEntity.js';
import { CustomField } from './customField.js';
import { NameEntity } from './nameEntity.js';
import { Layout } from './layout.js';
import { CustomMetadataRecord } from './customMetadataRecord.js';
import { OutdatedFlowVersions } from './outdatedFlowVersions.js';
import { FullNameSingleRecord } from './fullNameSingleRecord.js';
import { DynamicDevNamedEntityRelated } from './dynamicDevNamedEntityRelated.js';
import { SObjectBasedDefNameEntity } from './sobjectBasedDevNameEntity.js';
import { ApprovalProcessDefinition } from './approvalProcessDefinition.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'garbagecollection');

// eslint-disable-next-line arrow-body-style
export const loadSupportedMetadataTypes = (orgConnection: Connection): { [x: string]: EntityDefinitionHandler } => {
  return {
    ExternalString: new NameEntity(orgConnection.tooling, 'ExternalString', 'CustomLabel'),
    ApexClass: new NameEntity(orgConnection.tooling, 'ApexClass'),
    BusinessProcess: new NameEntity(orgConnection.tooling, 'BusinessProcess'),
    AuraDefinitionBundle: new DeveloperNameEntity(orgConnection.tooling, 'AuraDefinitionBundle'),
    FlowDefinition: new OutdatedFlowVersions(orgConnection),
    LightningComponentBundle: new DeveloperNameEntity(orgConnection.tooling, 'LightningComponentBundle'),
    FlexiPage: new DeveloperNameEntity(orgConnection.tooling, 'FlexiPage'),
    CustomMetadataRecord: new CustomMetadataRecord(orgConnection),
    Layout: new Layout(orgConnection),
    CustomObject: new CustomObject(orgConnection),
    CustomField: new CustomField(orgConnection),
    QuickActionDefinition: new SObjectBasedDefNameEntity(orgConnection, 'QuickActionDefinition', 'QuickAction'),
    WorkflowAlert: new DynamicDevNamedEntityRelated(orgConnection, 'WorkflowAlert', 'DeveloperName'),
    WorkflowFieldUpdate: new FullNameSingleRecord(orgConnection.tooling, 'WorkflowFieldUpdate'),
    StaticResource: new NameEntity(orgConnection.tooling, 'StaticResource'),
    CustomTab: new FullNameSingleRecord(orgConnection.tooling, 'CustomTab'),
    PermissionSet: new NameEntity(orgConnection.tooling, 'PermissionSet'),
    ValidationRule: new DynamicDevNamedEntityRelated(orgConnection, 'ValidationRule', 'ValidationName'),
    EmailTemplate: new FullNameSingleRecord(orgConnection.tooling, 'EmailTemplate'),
    CompactLayout: new SObjectBasedDefNameEntity(orgConnection, 'CompactLayout'),
    GlobalValueSet: new FullNameSingleRecord(orgConnection.tooling, 'GlobalValueSet'),
    FieldSet: new DynamicDevNamedEntityRelated(orgConnection, 'FieldSet', 'DeveloperName'),
    CustomApplication: new DeveloperNameEntity(orgConnection.tooling, 'CustomApplication'),
    ProcessDefinition: new ApprovalProcessDefinition(orgConnection),
  };
};

// eslint-disable-next-line arrow-body-style
export const loadUnsupportedMetadataTypes = (): { [x: string]: EntityDefinitionIgnorer } => {
  const toolingApiMsg = messages.getMessage('infos.not-fully-supported-by-tooling-api');
  return {
    EmailTemplate: new UnsupportedEntity('EmailTemplate', toolingApiMsg),
    ListView: new UnsupportedEntity('ListView', toolingApiMsg),
  };
};
