/**
 * Locally maintained types for objects from JSForce that
 * are not explicitly exported, but needed (usually for testing)
 */
import { Optional } from '@jsforce/jsforce-node';

export type RecordTypeInfo = {
  available: boolean;
  active: boolean;
  defaultRecordTypeMapping: boolean;
  master: boolean;
  name: string;
  developerName: string;
  recordTypeId: string;
  urls: {
    [key: string]: string;
  };
};

export type ChildRelationship = {
  cascadeDelete: boolean;
  childSObject: string;
  deprecatedAndHidden: boolean;
  field: string;
  junctionIdListNames: string[];
  junctionReferenceTo: string[];
  relationshipName: Optional<string>;
  restrictedDelete: boolean;
};
