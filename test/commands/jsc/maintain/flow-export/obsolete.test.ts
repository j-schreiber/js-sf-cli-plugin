import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { Messages } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JscMaintainExportObsoleteFlowVersions from '../../../../../src/commands/jsc/maintain/flow-export/obsolete.js';
import FlowExportTestContext, {
  parseMockResult,
  parsePackageXml,
} from '../../../../mock-utils/flowExportTestContext.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.flow-export.obsolete');

describe('jsc maintain flow-export obsolete', () => {
  const $$ = new FlowExportTestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(async () => {
    await $$.init();
    sfCommandStubs = stubSfCommandUx($$.coreContext.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('shows no table output and logs success when no obsolete versions are found', async () => {
    // Act
    await JscMaintainExportObsoleteFlowVersions.run(['--target-org', $$.testTargetOrg.username]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(0);
    expect(sfCommandStubs.logSuccess.args.flat()).to.deep.equal([
      messages.getMessage('success.no-obsolete-versions-found'),
    ]);
  });

  it('shows table output when obsolete versions are found', async () => {
    // Arrange
    $$.obsoleteFlows = parseMockResult('obsolete-flows.json');

    // Act
    await JscMaintainExportObsoleteFlowVersions.run(['--target-org', $$.testTargetOrg.username]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(1);
    // unused-flows.json has 5 records
    expect(sfCommandStubs.table.args.flat()[0].data.length).to.equal(3);
    expect(sfCommandStubs.logSuccess.callCount).to.equal(0);
  });

  it('shows summarized table output when obsolete versions are found with --concise flag', async () => {
    // Arrange
    $$.obsoleteFlows = parseMockResult('obsolete-flows.json');

    // Act
    await JscMaintainExportObsoleteFlowVersions.run(['--target-org', $$.testTargetOrg.username, '--concise']);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(1);
    // unused-flows.json has 5 records
    expect(sfCommandStubs.table.args.flat()[0]).to.deep.equal({
      data: [
        { FlowDefinitionName: 'Test_Flow_1', Versions: 2 },
        { FlowDefinitionName: 'Test_Flow_2', Versions: 1 },
      ],
    });
    expect(sfCommandStubs.logSuccess.callCount).to.equal(0);
  });

  it('exports explicit flow versions to package.xml with --concise flag', async () => {
    // Arrange
    $$.obsoleteFlows = parseMockResult('obsolete-flows.json');

    // Act
    const outputDir = `${$$.outputDir}/obsolete`;
    await JscMaintainExportObsoleteFlowVersions.run([
      '--target-org',
      $$.testTargetOrg.username,
      '--concise',
      '--output-dir',
      outputDir,
    ]);

    // Assert
    expect(sfCommandStubs.table.callCount).to.equal(1);
    expect(sfCommandStubs.table.callCount).to.equal(1);
    expect(sfCommandStubs.logSuccess.callCount).to.equal(0);
    const packageXmlPath = path.join(outputDir, 'package.xml');
    expect(fs.existsSync(packageXmlPath)).to.be.true;
    const packageXml = parsePackageXml(packageXmlPath);
    expect(packageXml.Package.types.length).to.equal(1);
    expect(packageXml.Package.types[0].name).to.equal('Flow');
    expect(packageXml.Package.types[0].members.length).to.equal(3);
  });
});
