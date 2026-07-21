import crypto from "node:crypto";

export interface AssetChecksum {
  key: string;
  checksum: string; // SHA-256
  byteSize: number;
  mimeType: string;
}

export function computeAssetChecksum(
  key: string,
  buffer: Buffer | ArrayBuffer,
  mimeType = "application/octet-stream",
): AssetChecksum {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");
  return {
    key,
    checksum,
    byteSize: buf.length,
    mimeType,
  };
}

export function verifyChecksumPair(
  source: AssetChecksum,
  destination: AssetChecksum,
): { matches: boolean; reason?: string } {
  if (source.checksum !== destination.checksum) {
    return {
      matches: false,
      reason: `Checksum mismatch: ${source.checksum} != ${destination.checksum}`,
    };
  }
  if (source.byteSize !== destination.byteSize) {
    return {
      matches: false,
      reason: `Size mismatch: ${source.byteSize} bytes != ${destination.byteSize} bytes`,
    };
  }
  return { matches: true };
}
