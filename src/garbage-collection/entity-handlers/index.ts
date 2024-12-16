import { Connection } from '@salesforce/core';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { ExternalString } from './externalString.js';
import { CustomObject } from './customObject.js';
import { DeveloperNameEntity } from './developerNameEntity.js';
import { UnsupportedEntity } from './unsupportedEntity.js';
import { CustomField } from './customField.js';

export const loadHandlers = (orgConnection: Connection): EntityDefinitionHandlers => {
  const handlers: EntityDefinitionHandlers = { supported: {}, unsupported: {} };
  handlers.supported['ExternalString'] = new ExternalString(orgConnection.tooling);
  handlers.supported['FlexiPage'] = new DeveloperNameEntity(orgConnection.tooling, 'FlexiPage');
  handlers.supported['CustomObject'] = new CustomObject(orgConnection);
  handlers.supported['CustomField'] = new CustomField(orgConnection);
  // not correctly implemented yet, does not resolve object
  // handlers.supported['QuickActionDefinition'] = new DeveloperNameEntity(
  //   orgConnection.tooling,
  //   'QuickActionDefinition',
  //   'QuickAction'
  // );
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
