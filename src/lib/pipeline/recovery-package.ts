import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// KMS Stub: In production, this master key is fetched securely via AWS KMS or HashiCorp Vault per user.
const KMS_MASTER_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, "hex") : Buffer.alloc(32, "0");

export interface RecoveryManifest {
  format: "recovery/2";
  generated_at: string;
  store_domain: string;
  catalog: { type: string; count: number }[];
  checksums: Record<string, string>; // filepath -> sha256
}

/**
 * RecoveryPackage SDK
 * Abstracts the complexity of reading/writing to the structured v2 recovery format.
 * In a Vercel environment, this reads/writes to Supabase Storage.
 */
export class RecoveryPackage {
  constructor(
    private admin: SupabaseClient, 
    private backupId: string,
    private bucket = "recovery_packages"
  ) {}

  /**
   * Initializes a new package
   */
  async initialize(domain: string) {
    const manifest: RecoveryManifest = {
      format: "recovery/2",
      generated_at: new Date().toISOString(),
      store_domain: domain,
      catalog: [],
      checksums: {},
    };
    await this.writeManifest(manifest);
  }

  /**
   * Reads the manifest
   */
  async readManifest(): Promise<RecoveryManifest> {
    const { data, error } = await this.admin.storage
      .from(this.bucket)
      .download(`${this.backupId}/manifest.json`);
    
    if (error || !data) throw new Error("Manifest not found or corrupt.");
    const text = await data.text();
    return JSON.parse(text);
  }

  /**
   * Writes the manifest safely
   */
  async writeManifest(manifest: RecoveryManifest) {
    const payload = JSON.stringify(manifest, null, 2);
    const { error } = await this.admin.storage
      .from(this.bucket)
      .upload(`${this.backupId}/manifest.json`, payload, { upsert: true, contentType: "application/json" });
    if (error) throw new Error(`Failed to write manifest: ${error.message}`);
  }

  /**
   * Streams a resource JSONL payload into the package, enforcing Application-Level Encryption (ALE)
   */
  async writeResource(type: string, data: Buffer | string) {
    const payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const path = `${this.backupId}/resources/${type}.jsonl.enc`;
    
    // Application-Level Encryption (AES-256-GCM)
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", KMS_MASTER_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Package IV + AuthTag + Ciphertext for storage
    const securePayload = Buffer.concat([iv, authTag, encrypted]);
    
    const { error } = await this.admin.storage
      .from(this.bucket)
      .upload(path, securePayload, { upsert: true, contentType: "application/octet-stream" });
      
    if (error) throw new Error(`Failed to write secure resource ${type}: ${error.message}`);
    
    // Hash unencrypted payload for integrity verification later
    const hash = createHash("sha256").update(payload).digest("hex");
    const manifest = await this.readManifest();
    manifest.checksums[`resources/${type}.jsonl`] = hash;
    
    // Update catalog count (simplified line count)
    const lineCount = payload.toString('utf8').split('\n').filter(l => l.trim().length > 0).length;
    const catIdx = manifest.catalog.findIndex(c => c.type === type);
    if (catIdx >= 0) manifest.catalog[catIdx].count = lineCount;
    else manifest.catalog.push({ type, count: lineCount });
    
    await this.writeManifest(manifest);
  }

  /**
   * Reads and decrypts a resource payload
   */
  async readResource(type: string): Promise<string> {
    const path = `${this.backupId}/resources/${type}.jsonl.enc`;
    const { data, error } = await this.admin.storage
      .from(this.bucket)
      .download(path);
      
    if (error || !data) throw new Error(`Failed to read secure resource ${type}.`);
    
    const secureBuffer = Buffer.from(await data.arrayBuffer());
    
    const iv = secureBuffer.subarray(0, 12);
    const authTag = secureBuffer.subarray(12, 28);
    const ciphertext = secureBuffer.subarray(28);
    
    const decipher = createDecipheriv("aes-256-gcm", KMS_MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    return decrypted.toString("utf8");
  }
  
  /**
   * Validates all checksums in the package
   */
  async validate(): Promise<boolean> {
    const manifest = await this.readManifest();
    for (const [path, expectedHash] of Object.entries(manifest.checksums)) {
      // If it's a secure resource, we must decrypt it to verify the hash
      const encPath = path.replace(".jsonl", ".jsonl.enc");
      const { data, error } = await this.admin.storage.from(this.bucket).download(`${this.backupId}/${encPath}`);
      if (error || !data) return false;
      
      const secureBuffer = Buffer.from(await data.arrayBuffer());
      const iv = secureBuffer.subarray(0, 12);
      const authTag = secureBuffer.subarray(12, 28);
      const ciphertext = secureBuffer.subarray(28);
      
      const decipher = createDecipheriv("aes-256-gcm", KMS_MASTER_KEY, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      
      const actualHash = createHash("sha256").update(decrypted).digest("hex");
      if (actualHash !== expectedHash) return false;
    }
    return true;
  }
}
