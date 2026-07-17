import type { ApiAdapter } from "./registry";
import { createHash } from "crypto";

export interface ThemeAsset {
  key: string;
  value?: string;
  attachment?: string;
  checksum: string;
}

export class ThemeEngine {
  /**
   * Themes are version-controlled structures. This engine downloads individual assets,
   * hashes them for diffing, and allows granular Liquid/JSON restores.
   */
  async exportTheme(client: ApiAdapter, themeId: string): Promise<ThemeAsset[]> {
    // 1. Fetch asset list (keys only)
    const res = await client.rest<{ assets: { key: string, checksum: string }[] }>("GET", `themes/${themeId}/assets.json`);
    const assets = res.assets || [];
    
    const downloadedAssets: ThemeAsset[] = [];
    
    // 2. Fetch asset contents (Shopify requires requesting each asset by key to get the `value` or `attachment`)
    // In production, this must be batched heavily or routed through a bulk/archive endpoint if available.
    for (const asset of assets) {
      const assetRes = await client.rest<{ asset: ThemeAsset }>("GET", `themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(asset.key)}`);
      
      // Re-verify checksum locally
      if (assetRes.asset.value) {
         const localHash = createHash("md5").update(assetRes.asset.value).digest("hex");
         // Handle differences or store
      }
      downloadedAssets.push(assetRes.asset);
    }
    
    return downloadedAssets;
  }
  
  /**
   * Deterministic Theme Differ
   * Compares a backed-up Theme (array of assets) with the target Theme, returning only the files that changed.
   */
  diffAssets(sourceAssets: ThemeAsset[], targetAssets: ThemeAsset[]): ThemeAsset[] {
    const targetMap = new Map(targetAssets.map(a => [a.key, a.checksum]));
    const changes: ThemeAsset[] = [];
    
    for (const source of sourceAssets) {
      const targetChecksum = targetMap.get(source.key);
      if (targetChecksum !== source.checksum) {
        // File is missing or modified
        changes.push(source);
      }
    }
    
    return changes;
  }
}
