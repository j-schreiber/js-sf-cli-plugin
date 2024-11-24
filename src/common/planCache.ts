export default class PlanCache {
  private static cache: Map<string, string[]> = new Map<string, []>();

  public static isSet(key: string): boolean {
    return this.cache.has(key);
  }

  public static get(key: string): string[] | undefined {
    return this.cache.get(key);
  }

  public static getNullSafe(key: string): string[] {
    if (this.isSet(key)) {
      return this.cache.get(key)!;
    }
    return [];
  }

  public static set(key: string, ids: string[]): void {
    this.cache.set(key, ids);
  }

  public static push(key: string, ids: string[]): void {
    if (this.isSet(key)) {
      this.get(key)?.push(...ids);
    } else {
      this.cache.set(key, ids);
    }
  }

  public static flush(): void {
    this.cache.clear();
  }
}
