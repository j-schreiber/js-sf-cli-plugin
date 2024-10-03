export const InvalidFieldInQuery = {
  data: {
    message:
      "\nSELECT Id,Invalid__x FROM Contact LIMIT 1\n          ^\nERROR at Row:1:Column:11\nNo such column 'Invalid__x' on entity 'Contact'. If you are attempting to use a custom field, be sure to append the '__c' after the custom field name. Please reference your WSDL or the describe call for the appropriate names.",
    errorCode: 'INVALID_FIELD',
  },
  errorCode: 'INVALID_FIELD',
  name: 'INVALID_FIELD',
};
