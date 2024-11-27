export default class PlanCache {
  public static CHUNK_SIZE = 400;
  private static cache: Map<string, Set<string>> = new Map<string, Set<string>>();

  public static isSet(key: string): boolean {
    return this.cache.has(key);
  }

  public static getChunks(key: string): string[][] {
    const allIds = this.getNullSafe(key);
    const chunks = [];
    for (let i = 0; i < allIds.length; i += PlanCache.CHUNK_SIZE) {
      chunks.push(allIds.slice(i, i + PlanCache.CHUNK_SIZE));
    }
    return chunks;
  }

  public static get(key: string): string[] | undefined {
    if (this.cache.get(key) !== undefined) {
      return Array.from(this.cache.get(key)!);
    }
    return;
  }

  public static getNullSafe(key: string): string[] {
    if (this.isSet(key)) {
      return Array.from(this.cache.get(key)!);
    }
    return [];
  }

  public static set(key: string, ids: string[]): void {
    this.cache.set(key, new Set(ids));
  }

  public static push(key: string, ids: string[]): void {
    if (this.cache.has(key)) {
      const cachedIds = this.cache.get(key)!;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ids.forEach(cachedIds.add, cachedIds);
    } else {
      this.set(key, ids);
    }
  }

  public static flush(): void {
    this.cache.clear();
  }
}
