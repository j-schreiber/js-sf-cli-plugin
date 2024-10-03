export default class ValidationResult {
  public errors: string[] = [];
  public infos: string[] = [];

  public isValid(): boolean {
    return this.errors.length === 0;
  }
}
