import { Record } from '@jsforce/jsforce-node';

export type Package2Version = {
  SubscriberPackageVersionId: string;
  SubscriberPackageVersion: SubscriberPackageVersion;
  Package2: Package2;
  IsReleased: boolean;
};

export type Package2 = {
  Id: string;
  SubscriberPackageId: string;
};

/** The one with id 04t */
export type SubscriberPackageVersion = {
  MajorVersion: number;
  MinorVersion: number;
  PatchVersion: number;
  IsBeta: boolean;
  IsPasswordProtected: boolean;
  SubscriberPackageId?: string;
};

/** The one with id 04t. When used as related parent */
export type ParentSubscriberPackageVersion = {
  SubscriberPackageId: string;
  MajorVersion: number;
  MinorVersion: number;
  PatchVersion: number;
};

export type InstalledSubscriberPackage = {
  SubscriberPackageId?: string;
  SubscriberPackageVersionId: string;
  SubscriberPackageVersion: SubscriberPackageVersion;
};

export type Package2Member = Record & {
  Id: string;
  SubscriberPackageId: string;
  CurrentPackageVersionId: string;
  CurrentPackageVersion?: ParentSubscriberPackageVersion;
  MaxPackageVersionId?: string;
  MaxPackageVersion?: ParentSubscriberPackageVersion;
  SubjectId: string;
  SubjectKeyPrefix: string;
  SubjectManageableState: 'deprecated' | 'deprecatedEditable';
};

export type EntityDefinition = Record & {
  Id: string;
  DurableId: string;
  QualifiedApiName: string;
  DeveloperName: string;
  MasterLabel: string;
  KeyPrefix: string;
  IsRetrievable: string;
};

export type NamedRecord = Record & {
  Id: string;
  Name: string;
};

export type DeveloperNamedRecord = Record & {
  Id: string;
  DeveloperName: string;
};

export type FieldDefinition = DeveloperNamedRecord & {
  Id: string;
  TableEnumOrId: string;
};

export type NamedSObjectChildType = NamedRecord & {
  TableEnumOrId: string;
};

export type QuickActionDefinitionType = DeveloperNamedRecord & {
  Id: string;
  EntityDefinitionId: string;
  SobjectType: string;
};

export type SobjectTypeDevNamedEntity = DeveloperNamedRecord & {
  SobjectType: string;
};

export type FlowVersionDefinition = {
  Id: string;
  Status: string;
  VersionNumber: number;
  DefinitionId: string;
  Definition: DeveloperNamedRecord;
};

export type WorkflowAlertEntity = DeveloperNamedRecord & {
  EntityDefinition: Partial<EntityDefinition>;
};

export type DynamicallyNamedEntity = {
  [devName: string]: unknown;
  Id: string;
  EntityDefinition: Partial<EntityDefinition>;
};

export type FullNameSingleRecordEntity = {
  Id: string;
  FullName: string;
};
