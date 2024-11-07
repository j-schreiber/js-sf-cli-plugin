export default class ValidationResult {
  public issues: ValidationIssue[] = [];
  public infos: string[] = [];

  public isValid(): boolean {
    return this.issues.length === 0;
  }
}

export type ValidationIssue = {
  issueType: ValidationIssueType;
  message: string;
};

export enum ValidationIssueType {
  'generic',
}
