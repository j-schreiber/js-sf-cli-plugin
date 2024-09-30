export type QueryError = {
  errorCode: string;
  name: string;
  data: { message: string; errorCode: string };
};
