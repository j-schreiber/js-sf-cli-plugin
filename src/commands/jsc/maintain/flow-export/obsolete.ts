import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { manifestOutputDirFlag, outputFormatFlag } from '../../../../common/jscSfCommandFlags.js';
import FlowExporter, { FlowClutter, writeFlowsToXml } from '../../../../common/flowExporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.flow-export.obsolete');

export type JscMaintainExportObsoleteFlowsResult = {
  obsoleteVersions: FlowClutter[];
};

export default class JscMaintainExportObsoleteFlowVersions extends SfCommand<JscMaintainExportObsoleteFlowsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
    'output-dir': manifestOutputDirFlag,
    'output-format': outputFormatFlag(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JscMaintainExportObsoleteFlowsResult> {
    const { flags } = await this.parse(JscMaintainExportObsoleteFlowVersions);
    const exporter = new FlowExporter(flags['target-org'].getConnection(flags['api-version']));
    const results = await exporter.exportObsoleteFlows();
    this.table({ data: results });
    if (flags['output-dir']) {
      this.info(`Writing output to: ${flags['output-dir']}`);
      writeFlowsToXml(results, flags['output-dir'], flags['output-format']);
    }
    if (results.length === 0) {
      this.logSuccess(messages.getMessage('success.no-obsolete-versions-found'));
    }
    return { obsoleteVersions: results };
  }
}
