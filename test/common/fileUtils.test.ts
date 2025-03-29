import path from 'node:path';
import { expect } from 'chai';
import { z } from 'zod';
import { SfError } from '@salesforce/core';
import { parseYaml } from '../../src/common/utils/fileUtils.js';

describe('file utils', () => {
  describe('parse yaml', () => {
    it('returns type of zod schema for existing valid file', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'valid.yaml');
      const contents = parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);

      // Assert
      expect(contents.options).to.deep.equal({ boolProp: true, stringProp: 'test' });
      expect(Object.keys(contents.record)).to.deep.equal(['Entry 1', 'Entry 2', 'Entry 3']);
    });

    it('throws descriptive error when invalid path is provided', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'does-not-exist.yaml');
      const parseYamlTest = () => parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);
      // Assert
      expect(parseYamlTest).to.throw(SfError);
      expect(parseYamlTest).to.throw(testPath);
    });

    it('throws descriptive error when incompatible file is provided', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'some-csv-file.csv');
      const parseYamlTest = () => parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);
      // Assert
      expect(parseYamlTest).to.throw(SfError);
      // zod error message, if content is a not a valid object
      expect(parseYamlTest).to.throw('Expected object, received string');
    });

    it('throws descriptive error with empty file', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'empty-file.yaml');
      const parseYamlTest = () => parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);
      // Assert
      expect(parseYamlTest).to.throw(SfError);
      // zod error message, if content is empty
      expect(parseYamlTest).to.throw('Required');
    });

    it('throws descriptive error with yaml file with unparseable contents', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'invalid.yaml');
      const parseYamlTest = () => parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);
      // Assert
      expect(parseYamlTest).to.throw(SfError);
      // zod error message for the invalid key due to strict parsing
      expect(parseYamlTest).to.throw("Unrecognized key(s) in object: 'invalidProperty'");
    });

    it('throws descriptive error with yaml file with missing contents', () => {
      // Act
      const testPath = path.join('test', 'data', 'file-utils', 'invalid-types.yaml');
      const parseYamlTest = () => parseYaml<typeof TestYamlSchema>(testPath, TestYamlSchema);
      // Assert
      expect(parseYamlTest).to.throw(SfError);
      // zod error message for the type mismatches
      expect(parseYamlTest).to.throw('options: Expected boolean, received string');
      expect(parseYamlTest).to.throw('Expected string, received number');
    });
  });
});

const TestSubSchema = z
  .object({
    boolProp: z.boolean().default(false),
    stringProp: z.string().nonempty(),
  })
  .strict('Valid options are: boolProp,stringProp');

const TestRecordSchema = z.object({ prop1: z.string().optional(), prop2: z.string().nonempty() }).strict();

const TestYamlSchema = z
  .object({
    options: TestSubSchema,
    record: z.record(TestRecordSchema).default({}),
  })
  .strict();
