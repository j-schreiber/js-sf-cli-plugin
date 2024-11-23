export default class PlanCache {
  private static cache: Map<string, string[]> = new Map<string, []>();

  public static isSet(key: string): boolean {
    return this.cache.has(key);
  }

  public static get(key: string): string[] | undefined {
    return this.cache.get(key);
  }

  public static set(key: string, ids: string[]): void {
    this.cache.set(key, ids);
  }

  public static flush(): void {
    this.cache.clear();
  }
}
