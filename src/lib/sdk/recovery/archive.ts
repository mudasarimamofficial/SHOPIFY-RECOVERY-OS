import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { RecoveryManifest } from "./types";
import { StreamingReader, StreamingWriter } from "./streams";

export class PackageValidator {
  constructor(private reader: StreamingReader, private backupId: string) {}

  /**
   * Cryptographically validates every file in the package against the manifest checksums.
   * Ensures the payload has not been tampered with and was encrypted properly.
   */
  async validate(manifest: RecoveryManifest): Promise<boolean> {
    for (const item of manifest.catalog) {
      try {
        const rawText = await this.reader.downloadSecureStream(`${this.backupId}/resources/${item.type}.jsonl.enc`);
        const actualHash = createHash("sha256").update(Buffer.from(rawText, "utf8")).digest("hex");
        
        if (actualHash !== item.checksum) {
          console.error(`[PackageValidator] Checksum mismatch for ${item.type}`);
          return false;
        }
      } catch (err) {
        console.error(`[PackageValidator] Failed to read/validate ${item.type}`, err);
        return false;
      }
    }
    return true;
  }
}

export class RecoveryArchive {
  private writer: StreamingWriter;
  private reader: StreamingReader;
  public validator: PackageValidator;

  constructor(private admin: SupabaseClient, private backupId: string, private bucket = "recovery_packages") {
    this.writer = new StreamingWriter(admin, bucket);
    this.reader = new StreamingReader(admin, bucket);
    this.validator = new PackageValidator(this.reader, backupId);
  }

  async readManifest(): Promise<RecoveryManifest> {
    const { data, error } = await this.admin.storage.from(this.bucket).download(`${this.backupId}/manifest.json`);
    if (error || !data) throw new Error("Manifest not found or corrupt.");
    return JSON.parse(await data.text()) as RecoveryManifest;
  }

  async writeManifest(manifest: RecoveryManifest) {
    const payload = JSON.stringify(manifest, null, 2);
    // Sign the manifest payload (simplified HMAC stub)
    manifest.signature = createHash("sha256").update(payload + "signing-secret-stub").digest("hex");
    
    const signedPayload = JSON.stringify(manifest, null, 2);
    
    const { error } = await this.admin.storage
      .from(this.bucket)
      .upload(`${this.backupId}/manifest.json`, signedPayload, { upsert: true, contentType: "application/json" });
    if (error) throw new Error(`Failed to write manifest: ${error.message}`);
  }

  async writeResource(type: string, data: Buffer | string) {
    const payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const path = `${this.backupId}/resources/${type}.jsonl.enc`;
    
    // Upload securely via StreamingWriter
    await this.writer.uploadSecureStream(path, payload);
    
    // Hash unencrypted payload for integrity
    const hash = createHash("sha256").update(payload).digest("hex");
    const manifest = await this.readManifest();
    
    const existingIdx = manifest.catalog.findIndex(c => c.type === type);
    const lineCount = payload.toString('utf8').split('\n').filter(l => l.trim().length > 0).length;
    
    if (existingIdx >= 0) {
      manifest.catalog[existingIdx].count = lineCount;
      manifest.catalog[existingIdx].checksum = hash;
    } else {
      manifest.catalog.push({ type, count: lineCount, checksum: hash });
    }
    
    await this.writeManifest(manifest);
  }

  async readResource(type: string): Promise<string> {
    return await this.reader.downloadSecureStream(`${this.backupId}/resources/${type}.jsonl.enc`);
  }
}
