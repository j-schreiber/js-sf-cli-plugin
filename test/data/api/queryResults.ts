export const InvalidFieldInQuery = {
  data: {
    message:
      "\nSELECT Id,Invalid__x FROM Contact LIMIT 1\n          ^\nERROR at Row:1:Column:11\nNo such column 'Invalid__x' on entity 'Contact'. If you are attempting to use a custom field, be sure to append the '__c' after the custom field name. Please reference your WSDL or the describe call for the appropriate names.",
    errorCode: 'INVALID_FIELD',
  },
  errorCode: 'INVALID_FIELD',
  name: 'INVALID_FIELD',
};

export const GenericRejection = {
  errorCode: 'UNEXPECTED_REJECT_WRONG_REQUEST',
  name: 'GENERIC_REJECTION',
};

export const GenericSuccess = {
  status: 0,
  records: [],
};

export const MockAccounts = [
  {
    attributes: {
      type: 'Account',
      url: '/services/data/v62.0/sobjects/Account/0019Q00000eC8UKQA0',
    },
    Id: '0019Q00000eC8UKQA0',
    Name: 'Sample Account for Entitlements',
  },
  {
    attributes: {
      type: 'Account',
      url: '/services/data/v62.0/sobjects/Account/0019Q00000eDKbNQAW',
    },
    Id: '0019Q00000eDKbNQAW',
    Name: 'Starship Galactica Ltd.',
  },
  {
    attributes: {
      type: 'Account',
      url: '/services/data/v62.0/sobjects/Account/0019Q00000eDKbOQAW',
    },
    Id: '0019Q00000eDKbOQAW',
    Name: 'Colonial One',
  },
  {
    attributes: {
      type: 'Account',
      url: '/services/data/v62.0/sobjects/Account/0019Q00000eDKbPQAW',
    },
    Id: '0019Q00000eDKbPQAW',
    Name: 'Cloud 9 GmbH',
  },
];
