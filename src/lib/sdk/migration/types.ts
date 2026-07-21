export type RecoveryFormat = "recovery/1" | "recovery/2";

export interface RecoveryManifest {
  format: RecoveryFormat;
  generated_at: string;
  store_domain: string;
  signature?: string; // Cryptographic signature of the package
  catalog: {
    type: string;
    count: number;
    checksum: string; // Hash of the individual resource file
  }[];
  media_catalog: {
    hash: string;
    path: string;
  }[];
}

export interface IncrementalConfig {
  since_timestamp: string;
  base_backup_id: string;
}

export interface ArchiveOptions {
  encrypt?: boolean;
  incremental?: IncrementalConfig;
}
