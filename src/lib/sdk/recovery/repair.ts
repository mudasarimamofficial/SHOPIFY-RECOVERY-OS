import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryManifest } from "./types";
import { RecoveryArchive } from "./archive";
import { createHash } from "crypto";

export class PackageInspector {
  constructor(private archive: RecoveryArchive) {}

  /**
   * Reads metadata without downloading the full payload.
   * Useful for UI dashboards to display "What's in this backup?" instantly.
   */
  async inspect(): Promise<RecoveryManifest> {
    return await this.archive.readManifest();
  }

  /**
   * Estimates total uncompressed size based on average payload sizes.
   */
  async estimateSize(manifest: RecoveryManifest): Promise<number> {
    let totalBytes = 0;
    for (const item of manifest.catalog) {
      // Rough heuristic: Average Shopify resource JSON is ~2KB.
      totalBytes += item.count * 2048; 
    }
    return totalBytes;
  }
}

export class PackageRepair {
  constructor(private admin: SupabaseClient, private backupId: string) {}

  /**
   * Attempts to salvage a corrupted package where the manifest.json is lost or invalid.
   * It scans the bucket for .jsonl.enc files, hashes them, counts them, and rebuilds the manifest.
   */
  async salvageManifest(storeDomain: string): Promise<void> {
    const { data: files, error } = await this.admin.storage
      .from("recovery_packages")
      .list(`${this.backupId}/resources`);

    if (error || !files) throw new Error("Could not list resources for salvage.");

    const archive = new RecoveryArchive(this.admin, this.backupId);
    
    const catalog = [];
    
    for (const file of files) {
      if (!file.name.endsWith(".jsonl.enc")) continue;
      
      const type = file.name.replace(".jsonl.enc", "");
      
      try {
        // We must download and decrypt it to hash it properly and count lines
        const rawText = await archive.readResource(type);
        const hash = createHash("sha256").update(Buffer.from(rawText, "utf8")).digest("hex");
        const count = rawText.split('\n').filter(l => l.trim().length > 0).length;
        
        catalog.push({ type, count, checksum: hash });
      } catch (e) {
        console.error(`[PackageRepair] Failed to salvage ${file.name}`, e);
      }
    }
    
    const manifest: RecoveryManifest = {
      format: "recovery/2",
      generated_at: new Date().toISOString(),
      store_domain: storeDomain,
      catalog,
      media_catalog: []
    };
    
    await archive.writeManifest(manifest);
  }
}
