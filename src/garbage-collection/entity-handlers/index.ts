import { Connection } from '@salesforce/core';
import { EntityDefinitionHandler } from '../entityDefinitionHandler.js';
import { ExternalString } from './externalString.js';
import { CustomObject } from './customObject.js';
import { FlexiPage } from './flexiPage.js';

export const loadHandlers = (orgConnection: Connection): EntityDefinitionHandlers => {
  const handlers: EntityDefinitionHandlers = {};
  handlers['ExternalString'] = new ExternalString(orgConnection.tooling);
  handlers['FlexiPage'] = new FlexiPage(orgConnection.tooling);
  handlers['CustomObject'] = new CustomObject(orgConnection.tooling);
  return handlers;
};

export type EntityDefinitionHandlers = {
  [x: string]: EntityDefinitionHandler;
};
