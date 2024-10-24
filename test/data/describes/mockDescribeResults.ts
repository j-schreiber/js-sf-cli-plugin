import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';

export const MockAnyObjectResult: Partial<DescribeSObjectResult> = {
  custom: true,
  createable: true,
  name: 'AnyObject',
  fields: [{ name: 'Id' } as Field, { name: 'Name' } as Field],
  urls: {
    sobject: '/services/data/v60.0/sobjects/AnyObject',
  },
};

export const MockAccountDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  name: 'Account',
  fields: [
    { name: 'Id' } as Field,
    { name: 'Name' } as Field,
    { name: 'AccountNumber' } as Field,
    { name: 'BillingStreet' } as Field,
  ],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Account',
  },
};

export const MockOrderDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  name: 'Order',
  fields: [
    { name: 'Id' } as Field,
    { name: 'OrderNumber' } as Field,
    { name: 'AccountId' } as Field,
    { name: 'BillToContactId' } as Field,
  ],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Order',
  },
};

export const MockPackageMemberDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: false,
  name: 'Package2Member',
  fields: [{ name: 'Id' } as Field, { name: 'SubjectId' } as Field],
  urls: {
    sobject: '/services/data/v60.0/tooling/sobjects/Package2Member',
  },
};
