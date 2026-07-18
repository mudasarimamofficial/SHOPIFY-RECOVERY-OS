import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Transform } from "stream";

// Recovery-package encryption key. Fail closed: never fall back to a default,
// zero, or placeholder key. Requires a 32-byte (64 hex char) ENCRYPTION_KEY.
let cachedKey: Buffer | undefined;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not configured; refusing to encrypt with a default key.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (64 hex chars) for AES-256-GCM; got ${key.length} bytes.`,
    );
  }
  cachedKey = key;
  return key;
}

export class EncryptTransform extends Transform {
  private iv = randomBytes(12);
  private cipher = createCipheriv("aes-256-gcm", getKey(), this.iv);

  constructor() {
    super();
    // We emit the IV first so the decipher knows what it is
    this.push(this.iv);
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: import("stream").TransformCallback,
  ): void {
    this.push(this.cipher.update(chunk));
    callback();
  }

  _flush(callback: import("stream").TransformCallback): void {
    this.push(this.cipher.final());
    // Finally append the 16-byte auth tag
    this.push(this.cipher.getAuthTag());
    callback();
  }
}

export class DecryptTransform extends Transform {
  private decipher: import("crypto").DecipherGCM | null = null;
  private iv: Buffer = Buffer.alloc(0);
  private buffer: Buffer = Buffer.alloc(0);

  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: import("stream").TransformCallback,
  ): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.decipher && this.buffer.length >= 12) {
      this.iv = this.buffer.subarray(0, 12);
      this.buffer = this.buffer.subarray(12);
      this.decipher = createDecipheriv("aes-256-gcm", getKey(), this.iv);
    }

    if (this.decipher && this.buffer.length > 16) {
      // We must leave at least 16 bytes in the buffer for the auth tag at flush time
      const toDecrypt = this.buffer.subarray(0, this.buffer.length - 16);
      this.push(this.decipher.update(toDecrypt));
      this.buffer = this.buffer.subarray(this.buffer.length - 16);
    }

    callback();
  }

  _flush(callback: import("stream").TransformCallback): void {
    if (this.decipher && this.buffer.length === 16) {
      this.decipher.setAuthTag(this.buffer);
      try {
        this.push(this.decipher.final());
        callback();
      } catch (err: any) {
        callback(err);
      }
    } else {
      callback(new Error("Invalid ciphertext or missing auth tag."));
    }
  }
}

export class StreamingWriter {
  constructor(
    private admin: SupabaseClient,
    private bucket: string,
  ) {}

  /**
   * For extremely large files (e.g. millions of orders), we utilize Supabase's S3-compatible
   * Multipart Upload API or Resumable Uploads.
   * Note: The Supabase JS client doesn't expose raw multipart nicely, so in Vercel Edge we
   * chunk manually into separate files if needed, or rely on TUS (Resumable uploads).
   */
  async uploadSecureStream(path: string, payload: Buffer | string) {
    // For this reference implementation, we wrap the simple upload,
    // but in a true streaming environment (Node.js runtime), this would pipe `fs.createReadStream`
    // through `EncryptTransform` to `@supabase/storage-js` via TUS resumable uploads.

    // Fallback simple buffer encryption since Supabase JS currently requires Blob/Buffer
    const data = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const securePayload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);

    const { error } = await this.admin.storage.from(this.bucket).upload(path, securePayload, {
      upsert: true,
      contentType: "application/octet-stream",
    });

    if (error) throw new Error(`StreamingWriter failed: ${error.message}`);
  }
}

export class StreamingReader {
  constructor(
    private admin: SupabaseClient,
    private bucket: string,
  ) {}

  async downloadSecureStream(path: string): Promise<string> {
    const { data, error } = await this.admin.storage.from(this.bucket).download(path);
    if (error || !data) throw new Error(`StreamingReader failed: ${error?.message || "Not found"}`);

    const secureBuffer = Buffer.from(await data.arrayBuffer());

    const iv = secureBuffer.subarray(0, 12);
    const authTag = secureBuffer.subarray(12, 28);
    const ciphertext = secureBuffer.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString("utf8");
  }
}
