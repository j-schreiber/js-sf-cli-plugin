import { expect } from 'chai';
import Sinon from 'sinon';
import { stubUx } from '@salesforce/sf-plugins-core';
import MarkdownResultsReporter from '../../src/common/reporters/markdownResultsReporter.js';

type MyTestType = {
  stringProp: string;
  numberProp: number;
  booleanProp: boolean;
  optionalStringProp?: string;
};

describe('reporters', () => {
  const SANDBOX = Sinon.createSandbox();
  let uxStub: ReturnType<typeof stubUx>;

  beforeEach(() => {
    uxStub = stubUx(SANDBOX);
  });

  afterEach(() => {
    SANDBOX.restore();
  });

  describe('markdown reporter', () => {
    it('formats array with all required properties as markdown table', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>([
        { stringProp: 'Test', numberProp: 1, booleanProp: true },
        { stringProp: 'Test 2', numberProp: 2, booleanProp: false },
      ]);

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(3);
      expect(tableData[0]).to.deep.equal(['stringProp', 'numberProp', 'booleanProp']);
      expect(tableData[1]).to.deep.equal(['Test', '1', 'true']);
      expect(tableData[2]).to.deep.equal(['Test 2', '2', 'false']);
    });

    it('formats array with with optional properties as markdown table', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>([
        { stringProp: 'Test', numberProp: 1, booleanProp: true },
        { stringProp: 'Test 2', numberProp: 2, booleanProp: false, optionalStringProp: 'Test' },
      ]);

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(3);
      expect(tableData[0]).to.deep.equal(['stringProp', 'numberProp', 'booleanProp', 'optionalStringProp']);
      expect(tableData[1]).to.deep.equal(['Test', '1', 'true', '']);
      expect(tableData[2]).to.deep.equal(['Test 2', '2', 'false', 'Test']);
    });

    it('formats array with with optional properties undefined as markdown table', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>([
        { stringProp: 'Test', numberProp: 1, booleanProp: true, optionalStringProp: undefined },
      ]);

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(2);
      expect(tableData[0]).to.deep.equal(['stringProp', 'numberProp', 'booleanProp', 'optionalStringProp']);
      expect(tableData[1]).to.deep.equal(['Test', '1', 'true', '']);
    });

    it('formats array with additional formatting options', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>(
        [{ stringProp: 'Test', numberProp: 1, booleanProp: true, optionalStringProp: undefined }],
        {
          formattings: {
            stringProp: { style: 'code' },
            numberProp: { style: 'bold' },
          },
        }
      );

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(2);
      expect(tableData[0]).to.deep.equal(['stringProp', 'numberProp', 'booleanProp', 'optionalStringProp']);
      expect(tableData[1]).to.deep.equal(['`Test`', '**1**', 'true', '']);
    });

    it('formats array with columns-only filter', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>(
        [
          { stringProp: 'Test', numberProp: 1, booleanProp: true, optionalStringProp: undefined },
          { stringProp: 'Test 2', numberProp: 100, booleanProp: false, optionalStringProp: 'Opt' },
        ],
        {
          columns: ['stringProp', 'booleanProp'],
        }
      );

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(3);
      expect(tableData[0]).to.deep.equal(['stringProp', 'booleanProp']);
      expect(tableData[1]).to.deep.equal(['Test', 'true']);
      expect(tableData[2]).to.deep.equal(['Test 2', 'false']);
    });

    it('formats array with exclude-columns filter', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>(
        [
          { stringProp: 'Test', numberProp: 1, booleanProp: true, optionalStringProp: undefined },
          { stringProp: 'Test 2', numberProp: 100, booleanProp: false, optionalStringProp: 'Opt' },
        ],
        {
          excludeColumns: ['booleanProp'],
        }
      );

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(3);
      expect(tableData[0]).to.deep.equal(['stringProp', 'numberProp', 'optionalStringProp']);
    });

    it('formats properties as capitalized column headers when option is set', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>(
        [{ stringProp: 'Test', numberProp: 1, booleanProp: true }],
        {
          capitalizeHeaders: true,
        }
      );

      // Act
      const tableData = reporter.prepare();

      // Assert
      expect(tableData.length).to.equal(2);
      expect(tableData[0]).to.deep.equal(['String Prop', 'Number Prop', 'Boolean Prop']);
    });

    it('prints simple array to UX.log', () => {
      // Arrange
      const reporter = new MarkdownResultsReporter<MyTestType>([
        { stringProp: 'Test', numberProp: 1, booleanProp: true },
        { stringProp: 'Test 2', numberProp: 2, booleanProp: false },
      ]);

      // Act
      reporter.print();

      // Assert
      expect(uxStub.log.callCount).to.equal(1);
      expect(uxStub.log.args.flat()[0]).to.contain('| stringProp | numberProp | booleanProp |');
      expect(uxStub.log.args.flat()[0]).to.contain('| Test       | 1          | true        |');
      expect(uxStub.log.args.flat()[0]).to.contain('| Test 2     | 2          | false       |');
    });
  });
});
