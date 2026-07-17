import { BaseBulkPlugin } from "./base-plugin";

export class MetaobjectReferencesPlugin extends BaseBulkPlugin {
  type = "metaobject_references";
  dependencies = [];

  getBulkQuery(): string {
    return `
      {
        ${this.type} {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
  }

  getRestoreMutation(): string {
    const singleName = this.type.replace(/s$/, "");
    return `
      mutation ${singleName}Create($input: ${singleName.charAt(0).toUpperCase() + singleName.slice(1)}Input!) {
        ${singleName}Create(input: $input) {
          ${singleName} { id }
          userErrors { field message }
        }
      }
    `;
  }
}
