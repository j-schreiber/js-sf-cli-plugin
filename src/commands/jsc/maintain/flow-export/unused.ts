import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import {
  conciseFlowExportTable,
  manifestOutputDirFlag,
  outputFormatFlag,
} from '../../../../common/jscSfCommandFlags.js';
import FlowExporter, { FlowClutter, summarize, writeFlowsToXml } from '../../../../common/flowExporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.flow-export.unused');

export type JscMaintainExportUnusedFlowsResult = {
  unusedVersions: FlowClutter[];
};
export default class JscMaintainExportUnusedFlows extends SfCommand<JscMaintainExportUnusedFlowsResult> {
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
    concise: conciseFlowExportTable,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JscMaintainExportUnusedFlowsResult> {
    const { flags } = await this.parse(JscMaintainExportUnusedFlows);
    const exporter = new FlowExporter(flags['target-org'].getConnection(flags['api-version']));
    const results = await exporter.exportUnusedFlows();
    if (results.length === 0) {
      this.logSuccess(messages.getMessage('success.no-unused-flows-found'));
    } else {
      this.printResults(results, flags.concise);
    }
    if (flags['output-dir']) {
      this.info(`Writing output to: ${flags['output-dir']}`);
      writeFlowsToXml(results, flags['output-dir'], flags['output-format']);
    }
    return { unusedVersions: results };
  }

  public printResults(clutter: FlowClutter[], concise?: boolean): void {
    if (concise) {
      this.table({ data: summarize(clutter) });
    } else {
      this.table({ data: clutter });
    }
  }
}
