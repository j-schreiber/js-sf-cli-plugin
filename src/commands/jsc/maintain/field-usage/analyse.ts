/* eslint-disable no-await-in-loop */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { Field } from '@jsforce/jsforce-node';
import DescribeApi from '../../../../common/metadata/describeApi.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'jsc.maintain.field-usage.analyse');

export type JscMaintainFieldUsageAnalyseResult = {
  usageReports: FieldUsageTable[];
};

export default class JscMaintainFieldUsageAnalyse extends SfCommand<JscMaintainFieldUsageAnalyseResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    sobject: Flags.string({
      multiple: true,
      required: true,
      char: 's',
      summary: messages.getMessage('flags.sobject.summary'),
      description: messages.getMessage('flags.sobject.description'),
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
      char: 'o',
      required: true,
    }),
    'custom-fields-only': Flags.boolean({
      summary: messages.getMessage('flags.custom-fields-only.summary'),
      description: messages.getMessage('flags.custom-fields-only.description'),
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JscMaintainFieldUsageAnalyseResult> {
    const { flags } = await this.parse(JscMaintainFieldUsageAnalyse);

    const targetOrg = flags['target-org'].getConnection(flags['api-version']);
    const describes = new DescribeApi(targetOrg);
    const sobjects = flags.sobject;
    const fieldUsageTables: FieldUsageTable[] = [];
    // show spinner that informs of status
    //  sobject describes (+ name validation)
    //  sobject analysis (update spinner per field)
    //  output formatting (sort table by count descending)
    for (const sobj of sobjects) {
      const desc = await describes.describeSObject(sobj);
      const totalCount = await getTotalCount(desc.name, targetOrg);
      const usageTable: FieldUsageTable = { name: desc.name, totalRecords: totalCount, fields: [] };
      this.log(`Total ${desc.labelPlural}: ${totalCount}`);
      if (totalCount && totalCount > 0) {
        for (const field of desc.fields) {
          if (!flags['custom-fields-only'] && !field.custom) {
            continue;
          }
          // map for fields of filterable and types first?
          if (
            field.filterable &&
            ['textarea', 'string', 'double', 'picklist', 'id', 'reference', 'date', 'datetime'].includes(field.type)
          ) {
            const fieldsPopulatedCount = await getPopulatedFieldCount(desc.name, field, targetOrg);
            usageTable.fields.push({
              name: field.name,
              type: field.type,
              absolutePopulated: fieldsPopulatedCount,
              percentagePopulated: (fieldsPopulatedCount / totalCount).toLocaleString('de', {
                style: 'percent',
                minimumFractionDigits: 2,
              }),
            });
          }
        }
      }
      fieldUsageTables.push(usageTable);
      this.table({ data: usageTable.fields, title: usageTable.name });
    }

    return { usageReports: fieldUsageTables };
  }
}

async function getTotalCount(sobjectName: string, conn: Connection): Promise<number> {
  const queryString = `SELECT COUNT(Id) FROM ${sobjectName}`;
  const result = await conn.query(queryString);
  return result.records[0]['expr0'] as number;
}

async function getPopulatedFieldCount(sobjectName: string, field: Field, conn: Connection): Promise<number> {
  const queryString = `SELECT COUNT(Id) FROM ${sobjectName} WHERE ${field.name} != NULL`;
  const result = await conn.query(queryString);
  return result.records[0]['expr0'] as number;
}

type FieldUsageTable = {
  name: string;
  totalRecords: number;
  fields: FieldUsageStats[];
};

type FieldUsageStats = {
  name: string;
  type: string;
  absolutePopulated: number;
  percentagePopulated: string;
};
