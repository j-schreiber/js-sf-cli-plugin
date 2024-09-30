import { Record } from '@jsforce/jsforce-node';

export class QueryError {
  public errorCode!: string;
  public name!: string;
  public data!: { message: string; errorCode: string };
}

export type QueryResult = {
  done: boolean;
  totalSize: number;
  records: Record[];
  nextRecordsUrl?: string;
};
