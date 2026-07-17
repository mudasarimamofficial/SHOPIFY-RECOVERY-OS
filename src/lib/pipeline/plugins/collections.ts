import { BaseBulkPlugin } from "./base-plugin";

export class CollectionPlugin extends BaseBulkPlugin {
  type = "collections";
  dependencies = ["products"];

  getBulkQuery(): string {
    return `
      {
        collections {
          edges {
            node {
              id
              title
              descriptionHtml
              handle
              updatedAt
            }
          }
        }
      }
    `;
  }

  getRestoreMutation(): string {
    return `
      mutation collectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id }
          userErrors { field message }
        }
      }
    `;
  }
}
