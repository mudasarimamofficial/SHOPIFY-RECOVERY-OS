import type { ShopifySDK } from "./client";

export class BulkOperations {
  constructor(private sdk: ShopifySDK) {}

  /**
   * Triggers a bulk operation mutation and polls until completion.
   * Returns the URL of the JSONL file to download.
   */
  async runBulkQuery(query: string): Promise<string> {
    const startMutation = `
      mutation {
        bulkOperationRunQuery(
          query: """
            ${query}
          """
        ) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await this.sdk.graphql<{ bulkOperationRunQuery: any }>(startMutation);
    const errors = res.bulkOperationRunQuery.userErrors;
    if (errors && errors.length > 0) {
      throw new Error(`Bulk operation failed to start: ${JSON.stringify(errors)}`);
    }

    const operationId = res.bulkOperationRunQuery.bulkOperation.id;

    // Polling loop
    while (true) {
      await new Promise(r => setTimeout(r, 5000)); // Poll every 5s

      const statusQuery = `
        query {
          currentBulkOperation {
            id
            status
            url
            errorCode
          }
        }
      `;
      const statusRes = await this.sdk.graphql<{ currentBulkOperation: any }>(statusQuery);
      const op = statusRes.currentBulkOperation;

      if (!op || op.id !== operationId) {
        throw new Error("Bulk operation lost or another operation interrupted it.");
      }

      if (op.status === "COMPLETED") {
        if (!op.url) return ""; // Valid case: No data matched the query
        return op.url;
      }

      if (op.status === "FAILED" || op.status === "CANCELED") {
        throw new Error(`Bulk operation ${op.status}: ${op.errorCode}`);
      }
    }
  }
}
