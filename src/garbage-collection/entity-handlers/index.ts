import { Connection } from '@salesforce/core';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { CustomObject } from './customObject.js';
import { DeveloperNameEntity } from './developerNameEntity.js';
import { UnsupportedEntity } from './unsupportedEntity.js';
import { CustomField } from './customField.js';
import { QuickActionDefinition } from './quickActionDefinition.js';
import { NameEntity } from './nameEntity.js';
import { Layout } from './layout.js';

export const loadHandlers = (orgConnection: Connection): EntityDefinitionHandlers => {
  const handlers: EntityDefinitionHandlers = { supported: {}, unsupported: {} };
  handlers.supported['ExternalString'] = new NameEntity(orgConnection.tooling, 'ExternalString', 'CustomLabel');
  handlers.supported['ApexClass'] = new NameEntity(orgConnection.tooling, 'ApexClass');
  handlers.supported['BusinessProcess'] = new NameEntity(orgConnection.tooling, 'BusinessProcess');
  handlers.supported['AuraDefinitionBundle'] = new DeveloperNameEntity(orgConnection.tooling, 'AuraDefinitionBundle');
  handlers.supported['FlexiPage'] = new DeveloperNameEntity(orgConnection.tooling, 'FlexiPage');
  handlers.supported['Layout'] = new Layout(orgConnection);
  handlers.supported['CustomObject'] = new CustomObject(orgConnection);
  handlers.supported['CustomField'] = new CustomField(orgConnection);
  handlers.supported['QuickActionDefinition'] = new QuickActionDefinition(orgConnection);
  handlers.unsupported['EmailTemplate'] = new UnsupportedEntity('EmailTemplate');
  handlers.unsupported['ListView'] = new UnsupportedEntity('ListView');
  handlers.unsupported['CustomTab'] = new UnsupportedEntity('CustomTab');
  return handlers;
};

export type EntityDefinitionHandlers = {
  supported: {
    [x: string]: EntityDefinitionHandler;
  };
  unsupported: {
    [x: string]: EntityDefinitionHandler;
  };
};
