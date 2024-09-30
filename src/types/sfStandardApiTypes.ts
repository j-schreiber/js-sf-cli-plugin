export class QueryError {
  public errorCode!: string;
  public name!: string;
  public data!: { message: string; errorCode: string };
}
