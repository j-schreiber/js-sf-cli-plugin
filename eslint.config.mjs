import salesforceTypescript from 'eslint-config-salesforce-typescript';
import sfPlugin from 'eslint-plugin-sf-plugin';
import globals from 'globals';

export default [
  ...salesforceTypescript,
  ...sfPlugin.configs.recommended,
  {
    rules: {
      'header/header': 'off',
      // a deliberate `default:` branch counts as exhaustive (pre-upgrade behaviour)
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      globals: globals.mocha,
    },
    rules: {
      // Allow assert style expressions. i.e. expect(true).to.be.true
      '@typescript-eslint/no-unused-expressions': 'off',
      // Return types are defined by the source code. Allows for quick overwrites.
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Mocked out the methods that shouldn't do anything in the tests.
      '@typescript-eslint/no-empty-function': 'off',
      // Easily return a promise in a mocked method.
      '@typescript-eslint/require-await': 'off',
      // API mocks reject with plain objects to mimic Salesforce API errors ({ errorCode, data })
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
];
