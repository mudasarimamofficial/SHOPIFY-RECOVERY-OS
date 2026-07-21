import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdMapRecord {
  migration_id: string;
  resource_type: string;
  source_id: string;
  destination_id: string;
}

/**
 * ID Mapper Engine
 * Ensures that Shopify IDs are never blindly reused.
 * Maps Source Store IDs (e.g. gid://shopify/Product/123) to Destination Store IDs (e.g. gid://shopify/Product/456).
 */
export class IdMapper {
  private admin: SupabaseClient;
  private migrationId: string;
  private userId: string;
  private memoryCache: Map<string, string>;

  constructor(admin: SupabaseClient, migrationId: string, userId: string) {
    this.admin = admin;
    this.migrationId = migrationId;
    this.userId = userId;
    this.memoryCache = new Map();
  }

  /**
   * Retrieves a mapped Destination ID for a given Source ID.
   * If not in memory, attempts to fetch from the database.
   */
  async get(sourceId: string, resourceType: string): Promise<string | null> {
    const cacheKey = `${resourceType}:${sourceId}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    const { data, error } = await this.admin
      .from("id_mappings")
      .select("destination_id")
      .eq("migration_id", this.migrationId)
      .eq("user_id", this.userId)
      .eq("resource_type", resourceType)
      .eq("source_id", sourceId)
      .single();

    if (error || !data) {
      return null;
    }

    if (this.memoryCache.size > 50000) {
      this.memoryCache.clear();
    }
    this.memoryCache.set(cacheKey, data.destination_id);
    return data.destination_id;
  }

  /**
   * Saves a mapped relationship between a Source ID and a Destination ID.
   */
  async set(sourceId: string, destinationId: string, resourceType: string): Promise<void> {
    if (this.memoryCache.size > 50000) {
      this.memoryCache.clear();
    }
    const cacheKey = `${resourceType}:${sourceId}`;
    this.memoryCache.set(cacheKey, destinationId);

    const { error } = await this.admin.from("id_mappings").upsert(
      {
        migration_id: this.migrationId,
        user_id: this.userId,
        resource_type: resourceType,
        source_id: sourceId,
        destination_id: destinationId,
      },
      {
        onConflict: "migration_id,resource_type,source_id",
      },
    );

    if (error) {
      this.memoryCache.delete(cacheKey);
      throw new Error(`Unable to persist ID mapping for ${resourceType}: ${error.message}`);
    }
  }
}
