import { BaseBulkPlugin } from "./base-plugin";

export class ProductPlugin extends BaseBulkPlugin {
  type = "products";
  dependencies = ["locations", "files"];

  getBulkQuery(): string {
    return `
      {
        products {
          edges {
            node {
              id
              title
              descriptionHtml
              vendor
              productType
              tags
              status
              updatedAt
            }
          }
        }
      }
    `;
  }

  getRestoreMutation(): string {
    return `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { id }
          userErrors { field message }
        }
      }
    `;
  }
}
