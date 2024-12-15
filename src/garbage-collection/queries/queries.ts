import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QueryBuilder from '../../common/utils/queryBuilder.js';

export const PACKAGE_MEMBER_QUERY: string = QueryBuilder.loadFromFile(getPath('package2members.sql'));
export const ENTITY_DEFINITION_QUERY: string = QueryBuilder.loadFromFile(getPath('entity-definitions-template.sql'));
export const ALL_CUSTOM_OBJECTS: string = QueryBuilder.loadFromFile(getPath('all-custom-object-entity-defs.sql'));

function getPath(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), fileName);
}
