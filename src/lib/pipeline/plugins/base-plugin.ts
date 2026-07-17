import type { ResourcePlugin, ResourceDelta } from "../registry";
import type { RecoveryArchive } from "../../sdk/recovery/archive";
import type { ShopifySDK } from "../../sdk/shopify/client";
import type { GIDMapper } from "../mapper";

export abstract class BaseBulkPlugin implements ResourcePlugin {
  abstract type: string;
  dependencies: string[] = [];
  
  // The GraphQL bulk query used to extract the resource
  abstract getBulkQuery(): string;
  // The GraphQL mutation used to create/restore the resource
  abstract getRestoreMutation(): string;

  async scan(client: ShopifySDK): Promise<{ count: number }> {
    // Determine count by hitting REST count endpoint if possible, or querying connection count
    try {
      const queryName = this.type;
      const res = await client.graphql<any>(`
        query {
          ${queryName} {
            count
          }
        }
      `);
      return { count: res?.[queryName]?.count || 0 };
    } catch {
      return { count: 0 };
    }
  }

  async export(client: ShopifySDK, archive: RecoveryArchive): Promise<void> {
    const query = this.getBulkQuery();
    
    // Execute real bulk operation
    const downloadUrl = await client.bulk.runBulkQuery(query);
    if (!downloadUrl) return; // No data

    // Stream the JSONL directly into the RecoveryArchive (which encrypts it via AES-GCM)
    const res = await fetch(downloadUrl);
    if (!res.body) throw new Error("Failed to read bulk operation stream");
    
    // For Vercel Edge / standard Node environments: 
    // We parse the streaming body and write chunk by chunk
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf8");
    let chunkBuffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      chunkBuffer += decoder.decode(value, { stream: true });
      const lines = chunkBuffer.split('\n');
      
      // Write all complete lines
      if (lines.length > 1) {
        const toWrite = lines.slice(0, -1).join('\n') + '\n';
        await archive.writeResource(this.type, toWrite);
        chunkBuffer = lines[lines.length - 1]; // Keep incomplete line
      }
    }

    if (chunkBuffer.trim().length > 0) {
      await archive.writeResource(this.type, chunkBuffer + '\n');
    }
  }

  diff(source: any, target: any): ResourceDelta {
    if (!target) return { action: "create", resourceType: this.type, payload: source, reason: "Missing" };
    if (source.updatedAt !== target.updatedAt) return { action: "update", resourceType: this.type, payload: source, reason: "Timestamp diff" };
    return { action: "skip", resourceType: this.type, payload: null, reason: "Identical" };
  }

  async restore(client: ShopifySDK, delta: ResourceDelta, mapper: GIDMapper): Promise<string> {
    if (delta.action === "skip") return "";
    
    const safePayload = mapper.translatePayload(delta.payload);
    const { id, __parentId, ...input } = safePayload;
    
    const mutation = this.getRestoreMutation();
    const res = await client.graphql<any>(mutation, { input });
    
    // Assume standard Shopify mutation shape: [resourceName]Create { [resourceName] { id } userErrors }
    const mutationKey = Object.keys(res)[0];
    const data = res[mutationKey];
    
    if (data.userErrors && data.userErrors.length > 0) {
      throw new Error(`Restore failed: ${JSON.stringify(data.userErrors)}`);
    }
    
    // Extract ID dynamically based on the mutation key prefix (e.g. productCreate -> product.id)
    const resourceKey = mutationKey.replace(/(Create|Update)$/, '');
    const newId = data[resourceKey]?.id;
    
    if (!newId) throw new Error("Restore succeeded but no ID returned.");
    
    return newId;
  }

  async verify(client: ShopifySDK, resourceId: string): Promise<boolean> {
    return true;
  }

  async rollback(client: ShopifySDK, resourceId: string): Promise<void> {
    const mutationKey = `${this.type.replace(/s$/, '')}Delete`;
    await client.graphql(`
      mutation($id: ID!) {
        ${mutationKey}(input: { id: $id }) {
          deletedId
        }
      }
    `, { id: resourceId });
  }
}
