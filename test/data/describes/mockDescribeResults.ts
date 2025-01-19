import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';

export const MockAnyObjectResult: Partial<DescribeSObjectResult> = {
  custom: true,
  createable: true,
  name: 'AnyObject',
  fields: [
    { name: 'Id', type: 'id' } as Field,
    { name: 'Name', type: 'string' } as Field,
    { name: 'AccountId', type: 'reference' } as Field,
  ],
  urls: {
    sobject: '/services/data/v60.0/sobjects/AnyObject',
  },
};

export const MockAccountDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: true,
  name: 'Account',
  fields: [
    { name: 'Id', type: 'id' } as Field,
    { name: 'Name', type: 'string' } as Field,
    { name: 'AccountNumber', type: 'string' } as Field,
    { name: 'CreatedDate', type: 'datetime' } as Field,
    { name: 'BillingStreet', type: 'textarea' } as Field,
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
    { name: 'Id', type: 'id' } as Field,
    { name: 'OrderNumber' } as Field,
    { name: 'AccountId', type: 'reference' } as Field,
    { name: 'BillToContactId', type: 'reference' } as Field,
  ],
  urls: {
    sobject: '/services/data/v60.0/sobjects/Order',
  },
};

export const MockPackageMemberDescribeResult: Partial<DescribeSObjectResult> = {
  custom: false,
  createable: false,
  name: 'Package2Member',
  fields: [{ name: 'Id', type: 'id' } as Field, { name: 'SubjectId' } as Field],
  urls: {
    sobject: '/services/data/v60.0/tooling/sobjects/Package2Member',
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const mockDescribeResults = (objectName: string, isToolingObject?: boolean): Promise<DescribeSObjectResult> => {
  switch (objectName) {
    case 'Account':
      return Promise.resolve(MockAccountDescribeResult as DescribeSObjectResult);
    case 'Order':
      return Promise.resolve(MockOrderDescribeResult as DescribeSObjectResult);
    case 'Package2Member':
      return Promise.resolve(MockPackageMemberDescribeResult as DescribeSObjectResult);
    default:
      return Promise.resolve(MockAnyObjectResult as DescribeSObjectResult);
  }
};
