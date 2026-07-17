import type { RecoveryArchive } from "./archive";
import type { RecoveryManifest } from "./types";

export class PackageDiffer {
  /**
   * Compares a base backup archive against an incremental snapshot.
   * Returns a map of resources that actually changed.
   * Useful for "Incremental Export" to avoid rewriting massive unmodified files.
   */
  async calculateDelta(baseArchive: RecoveryArchive, newManifest: RecoveryManifest): Promise<string[]> {
    const baseManifest = await baseArchive.readManifest();
    const changedResources: string[] = [];

    const baseCatalogMap = new Map(baseManifest.catalog.map(c => [c.type, c.checksum]));

    for (const item of newManifest.catalog) {
      const baseChecksum = baseCatalogMap.get(item.type);
      if (baseChecksum !== item.checksum) {
        changedResources.push(item.type);
      }
    }

    return changedResources;
  }
}

export class PackageMigrator {
  /**
   * Upgrades a recovery/1 format (unencrypted, unsigned) manifest to recovery/2 format.
   */
  async upgradeToV2(admin: import("@supabase/supabase-js").SupabaseClient, backupId: string): Promise<void> {
    // Read the old format from storage
    const { data, error } = await admin.storage.from("recovery_packages").download(`${backupId}/manifest.json`);
    if (error || !data) throw new Error("Could not read v1 manifest.");
    
    const v1 = JSON.parse(await data.text());
    
    if (v1.format === "recovery/2") return; // Already v2
    
    // Production migration: v1 archives were unencrypted, v2 archives require encryption.
    // To fully migrate an archive, we would need to stream and re-encrypt all resources.
    // For now, we upgrade the manifest format to allow v2 readers to process the old data
    // in a backwards-compatible mode (if the reader supports it) or schedule a background re-encryption.
    const v2: RecoveryManifest = {
      format: "recovery/2",
      generated_at: v1.generated_at || new Date().toISOString(),
      store_domain: v1.store_domain,
      catalog: v1.catalog || [],
      media_catalog: v1.media_catalog || []
    };
    
    // Using the new Archive to write will auto-sign it
    const { RecoveryArchive } = await import("./archive");
    const archive = new RecoveryArchive(admin, backupId);
    await archive.writeManifest(v2);
  }
}
