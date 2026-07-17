import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { globalEventBus } from "./event-bus";

export class MediaEngine {
  constructor(
    private admin: SupabaseClient,
    private backupId: string,
  ) {}

  /**
   * Downloads an asset from a Shopify CDN URL, deduplicates it using SHA-256,
   * and stores it securely in the Recovery Package.
   * Returns the deduplicated asset mapping.
   */
  async backupAsset(url: string, filename: string): Promise<{ hash: string; path: string }> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch media: ${res.statusText}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const hash = createHash("sha256").update(buffer).digest("hex");

      // Store in content-addressable storage structure to deduplicate identical files
      // (e.g. the same product image used across multiple variants)
      const storagePath = `${this.backupId}/media/${hash}`;

      // We rely on Supabase Storage upsert to avoid redundant writes of the same hash
      await this.admin.storage.from("recovery_packages").upload(storagePath, buffer, {
        upsert: true,
        contentType: res.headers.get("content-type") || "application/octet-stream",
      });

      return { hash, path: storagePath };
    } catch (err: any) {
      await globalEventBus.emit("Error", {
        jobId: this.backupId,
        storeDomain: "unknown",
        timestamp: new Date().toISOString(),
        meta: { engine: "MediaEngine", file: filename, error: err.message },
      });
      throw err;
    }
  }

  /**
   * Generates a signed URL from the storage bucket to provide back to Shopify
   * during a restore mutation (so Shopify can ingest the image).
   */
  async getPresignedUrlForRestore(hash: string): Promise<string> {
    const storagePath = `${this.backupId}/media/${hash}`;
    const { data, error } = await this.admin.storage
      .from("recovery_packages")
      .createSignedUrl(storagePath, 3600);

    if (error || !data) throw new Error(`Failed to generate signed URL for media hash: ${hash}`);
    return data.signedUrl;
  }
}
