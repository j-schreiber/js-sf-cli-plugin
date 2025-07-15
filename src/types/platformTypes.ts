import { DescribeSObjectResult, Optional } from '@jsforce/jsforce-node';

export type DescribeRecordTypeResult = {
  id: string;
  active: boolean;
  label: string;
  businessProcess: Optional<string>;
  compactLayoutAssignment: Optional<string>;
  description: Optional<string>;
  picklistValues: RecordTypePicklist[];
};

export type RecordTypePicklist = {
  picklist: string;
  values: Array<Partial<RecordTypePicklistValue>>;
};

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

export type DescribeHistoryResult = {
  relationship: ChildRelationship;
  describe: DescribeSObjectResult;
};

type RecordTypePicklistValue = {
  valueName: string;
  allowEmail: Optional<string>;
  color: Optional<string>;
  controllingFieldValues: Optional<string>;
  converted: Optional<string>;
  cssExposed: Optional<string>;
  description: Optional<string>;
  forecastCategory: Optional<string>;
  highPriority: Optional<string>;
  isActive: Optional<boolean>;
  probability: Optional<string>;
  reverseRole: Optional<string>;
  urls: Optional<string>;
  default: false;
  closed: Optional<boolean>;
  reviewed: Optional<boolean>;
  won: Optional<boolean>;
};
