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
