import { ZReleaseManifestType } from '../types/releaseManifest.js';

export default class OrgManifest {
  private environmentsMap = new Map<string, string>();

  public constructor(public data: ZReleaseManifestType) {
    if (this.data.environments) {
      Object.entries(this.data.environments).forEach(([key, value]) => {
        this.environmentsMap.set(value, key);
      });
    }
  }

  public getEnvironmentName(targetUsername: string): string | undefined {
    return this.environmentsMap.get(targetUsername);
  }
}
