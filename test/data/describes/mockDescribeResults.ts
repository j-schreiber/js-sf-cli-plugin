import { DescribeSObjectResult, Field } from '@jsforce/jsforce-node';

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
};
