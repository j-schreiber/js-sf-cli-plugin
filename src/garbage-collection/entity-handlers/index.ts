import { Connection, Messages } from '@salesforce/core';
import { EntityDefinitionHandler, EntityDefinitionIgnorer } from '../entityDefinitionHandler.js';
import { CustomObject } from './customObject.js';
import { DeveloperNameEntity } from './developerNameEntity.js';
import { UnsupportedEntity } from './unsupportedEntity.js';
import { CustomField } from './customField.js';
import { QuickActionDefinition } from './quickActionDefinition.js';
import { NameEntity } from './nameEntity.js';
import { Layout } from './layout.js';
import { CustomMetadataRecord } from './customMetadataRecord.js';
import { OutdatedFlowVersions } from './outdatedFlowVersions.js';
import { WorkflowAlert } from './workflowAlert.js';

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
    QuickActionDefinition: new QuickActionDefinition(orgConnection),
    WorkflowAlert: new WorkflowAlert(orgConnection),
  };
};

// eslint-disable-next-line arrow-body-style
export const loadUnsupportedMetadataTypes = (): { [x: string]: EntityDefinitionIgnorer } => {
  const toolingApiMsg = messages.getMessage('infos.not-fully-supported-by-tooling-api');
  return {
    EmailTemplate: new UnsupportedEntity('EmailTemplate', toolingApiMsg),
    ListView: new UnsupportedEntity('ListView', toolingApiMsg),
    CustomTab: new UnsupportedEntity('CustomTab', toolingApiMsg),
  };
};
