import type { ShopifyClient } from "../../shopify.server";

// Hard limit to prevent OOM during massive enterprise comparisons
const MAX_COMPARE_LIMIT = 50000;

async function fetchAllGraphQL(client: ShopifyClient, baseQuery: string, resource: string): Promise<any[]> {
  let allNodes: any[] = [];
  let hasNext = true;
  let cursor: string | null = null;

  // Insert pageInfo into the query automatically
  const injectPageInfo = (q: string, c: string | null) => {
    const after = c ? `, after: "${c}"` : "";
    return q.replace(/\(first: (\d+)\)/, `(first: $1${after})`).replace(
      /edges \{/,
      `pageInfo { hasNextPage endCursor } edges {`
    );
  };

  while (hasNext && allNodes.length < MAX_COMPARE_LIMIT) {
    const q = injectPageInfo(baseQuery, cursor);
    const res = await client.graphql<any>(q);
    const connection = res[resource];
    
    if (!connection) break;
    
    const nodes = connection.edges?.map((e: any) => e.node) || [];
    allNodes.push(...nodes);

    if (connection.pageInfo?.hasNextPage) {
      cursor = connection.pageInfo.endCursor;
    } else {
      hasNext = false;
    }
  }

  if (allNodes.length >= MAX_COMPARE_LIMIT) {
    console.warn(`[WARNING] Comparison truncated at ${MAX_COMPARE_LIMIT} items to prevent memory exhaustion.`);
  }

  return allNodes;
}

export type DiscrepancyClass = "Migration Defect" | "Shopify Limitation" | "Intentional Exclusion";

export interface Discrepancy {
  resource: string;
  id: string;
  reason: string;
  class: DiscrepancyClass;
}

export interface ComparisonReport {
  resourceType: string;
  resourcesChecked: number;
  matches: number;
  mismatches: number;
  discrepancies: Discrepancy[];
}

export async function compareProducts(
  clientA: ShopifyClient,
  clientB: ShopifyClient,
): Promise<ComparisonReport> {
  const report: ComparisonReport = {
    resourceType: "Products",
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    discrepancies: [],
  };

  const query = `{ products(first: 250) { edges { node { 
    handle title status vendor productType tags descriptionHtml seo { title description } options { name values } 
    variants(first: 50) { edges { node { title sku barcode price compareAtPrice requiresShipping inventoryPolicy inventoryItem { measurement { weight { value unit } } } selectedOptions { name value } } } } 
  } } } }`;

  const prodA = await fetchAllGraphQL(clientA, query, "products");
  const prodB = await fetchAllGraphQL(clientB, query, "products");

  report.resourcesChecked += prodA.length;

  for (const a of prodA) {
    const b = prodB.find((p: any) => p.handle === a.handle);
    if (!b) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "Product",
        id: a.handle,
        reason: "Missing in Destination",
        class: "Migration Defect",
      });
      continue;
    }

    let pMatch = true;
    const assertEqual = (field: string, valA: any, valB: any, rsc: string, id: string) => {
      if (valA !== valB && !(valA === null && valB === "")) {
        pMatch = false;
        report.discrepancies.push({
          resource: rsc,
          id,
          reason: `${field} mismatch: ${valA} != ${valB}`,
          class: "Migration Defect",
        });
      }
    };

    assertEqual("title", a.title, b.title, "Product", a.handle);
    assertEqual("status", a.status, b.status, "Product", a.handle);
    assertEqual("vendor", a.vendor, b.vendor, "Product", a.handle);
    assertEqual("productType", a.productType, b.productType, "Product", a.handle);

    if (a.tags.sort().join(",") !== b.tags.sort().join(",")) {
      pMatch = false;
      report.discrepancies.push({
        resource: "Product",
        id: a.handle,
        reason: `Tags mismatch`,
        class: "Migration Defect",
      });
    }

    if (a.seo?.title !== b.seo?.title || a.seo?.description !== b.seo?.description) {
      pMatch = false;
      report.discrepancies.push({
        resource: "Product",
        id: a.handle,
        reason: `SEO mismatch`,
        class: "Migration Defect",
      });
    }

    const vAs = a.variants.edges.map((e: any) => e.node);
    const vBs = b.variants.edges.map((e: any) => e.node);

    for (const vA of vAs) {
      const vB = vBs.find((v: any) => (v.sku && v.sku === vA.sku) || v.title === vA.title);
      if (!vB) {
        pMatch = false;
        report.discrepancies.push({
          resource: "ProductVariant",
          id: `${a.handle}/${vA.sku || vA.title}`,
          reason: "Missing in Destination",
          class: "Migration Defect",
        });
        continue;
      }
      assertEqual("price", vA.price, vB.price, "ProductVariant", vA.sku || vA.title);
      assertEqual(
        "compareAtPrice",
        vA.compareAtPrice,
        vB.compareAtPrice,
        "ProductVariant",
        vA.sku || vA.title,
      );
      assertEqual("barcode", vA.barcode, vB.barcode, "ProductVariant", vA.sku || vA.title);
      assertEqual("weight", vA.inventoryItem?.measurement?.weight?.value, vB.inventoryItem?.measurement?.weight?.value, "ProductVariant", vA.sku || vA.title);
      assertEqual("weightUnit", vA.inventoryItem?.measurement?.weight?.unit, vB.inventoryItem?.measurement?.weight?.unit, "ProductVariant", vA.sku || vA.title);
      assertEqual(
        "requiresShipping",
        vA.requiresShipping,
        vB.requiresShipping,
        "ProductVariant",
        vA.sku || vA.title,
      );
      assertEqual(
        "inventoryPolicy",
        vA.inventoryPolicy,
        vB.inventoryPolicy,
        "ProductVariant",
        vA.sku || vA.title,
      );
    }

    if (pMatch) report.matches++;
  }

  return report;
}

export async function compareCollections(
  clientA: ShopifyClient,
  clientB: ShopifyClient,
): Promise<ComparisonReport> {
  const report: ComparisonReport = {
    resourceType: "Collections",
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    discrepancies: [],
  };

  const query = `{ collections(first: 250) { edges { node { handle title descriptionHtml sortOrder templateSuffix ruleSet { appliedDisjunctively rules { column condition relation } } } } } }`;
  const colA = await fetchAllGraphQL(clientA, query, "collections");
  const colB = await fetchAllGraphQL(clientB, query, "collections");

  report.resourcesChecked += colA.length;

  for (const a of colA) {
    const b = colB.find((c: any) => c.handle === a.handle);
    if (!b) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "Collection",
        id: a.handle,
        reason: "Missing in Destination",
        class: "Migration Defect",
      });
      continue;
    }

    let cMatch = true;
    const assertEqual = (field: string, valA: any, valB: any, rsc: string, id: string) => {
      if (valA !== valB && !(valA === null && valB === "")) {
        cMatch = false;
        report.discrepancies.push({
          resource: rsc,
          id,
          reason: `${field} mismatch: ${valA} != ${valB}`,
          class: "Migration Defect",
        });
      }
    };

    assertEqual("title", a.title, b.title, "Collection", a.handle);
    assertEqual("sortOrder", a.sortOrder, b.sortOrder, "Collection", a.handle);
    assertEqual("templateSuffix", a.templateSuffix, b.templateSuffix, "Collection", a.handle);

    if (a.ruleSet || b.ruleSet) {
      if (!a.ruleSet || !b.ruleSet) {
        cMatch = false;
        report.discrepancies.push({
          resource: "Collection",
          id: a.handle,
          reason: `RuleSet presence mismatch`,
          class: "Migration Defect",
        });
      } else {
        assertEqual(
          "appliedDisjunctively",
          a.ruleSet.appliedDisjunctively,
          b.ruleSet.appliedDisjunctively,
          "Collection",
          a.handle,
        );
        const rulesA = JSON.stringify(a.ruleSet.rules);
        const rulesB = JSON.stringify(b.ruleSet.rules);
        if (rulesA !== rulesB) {
          cMatch = false;
          report.discrepancies.push({
            resource: "Collection",
            id: a.handle,
            reason: `Rules mismatch`,
            class: "Migration Defect",
          });
        }
      }
    }

    if (cMatch) report.matches++;
  }

  return report;
}

export async function compareCustomers(
  clientA: ShopifyClient,
  clientB: ShopifyClient,
): Promise<ComparisonReport> {
  const report: ComparisonReport = {
    resourceType: "Customers",
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    discrepancies: [],
  };

  const query = `{ customers(first: 250) { edges { node { email phone firstName lastName tags note state } } } }`;
  const cusA = await fetchAllGraphQL(clientA, query, "customers");
  const cusB = await fetchAllGraphQL(clientB, query, "customers");

  report.resourcesChecked += cusA.length;

  for (const a of cusA) {
    if (!a.email && !a.phone) continue;
    const b = cusB.find(
      (c: any) => (a.email && c.email === a.email) || (a.phone && c.phone === a.phone),
    );
    if (!b) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "Customer",
        id: a.email || a.phone,
        reason: "Missing in Destination",
        class: "Migration Defect",
      });
      continue;
    }

    let cMatch = true;
    const assertEqual = (field: string, valA: any, valB: any, rsc: string, id: string) => {
      if (valA !== valB && !(valA === null && valB === "")) {
        cMatch = false;
        report.discrepancies.push({
          resource: rsc,
          id,
          reason: `${field} mismatch: ${valA} != ${valB}`,
          class: "Migration Defect",
        });
      }
    };

    assertEqual("firstName", a.firstName, b.firstName, "Customer", a.email);
    assertEqual("lastName", a.lastName, b.lastName, "Customer", a.email);
    assertEqual("phone", a.phone, b.phone, "Customer", a.email);
    assertEqual("note", a.note, b.note, "Customer", a.email);

    if (a.tags.sort().join(",") !== b.tags.sort().join(",")) {
      cMatch = false;
      report.discrepancies.push({
        resource: "Customer",
        id: a.email,
        reason: `Tags mismatch`,
        class: "Migration Defect",
      });
    }

    if (a.state !== b.state) {
      report.discrepancies.push({
        resource: "Customer",
        id: a.email,
        reason: `State mismatch: ${a.state} != ${b.state}`,
        class: "Shopify Limitation",
      });
    }

    if (cMatch) report.matches++;
  }

  return report;
}

export async function comparePages(
  clientA: ShopifyClient,
  clientB: ShopifyClient,
): Promise<ComparisonReport> {
  const report: ComparisonReport = {
    resourceType: "Pages",
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    discrepancies: [],
  };

  const query = `{ pages(first: 250) { edges { node { handle title body templateSuffix } } } }`;
  const resA = await clientA.graphql<any>(query);
  const resB = await clientB.graphql<any>(query);

  const pagesA = resA.pages?.edges?.map((e: any) => e.node) || [];
  const pagesB = resB.pages?.edges?.map((e: any) => e.node) || [];

  report.resourcesChecked += pagesA.length;

  for (const a of pagesA) {
    const b = pagesB.find((p: any) => p.handle === a.handle);
    if (!b) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "Page",
        id: a.handle,
        reason: "Missing in Destination",
        class: "Migration Defect",
      });
      continue;
    }
    if (a.title !== b.title || a.body !== b.body || a.templateSuffix !== b.templateSuffix) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "Page",
        id: a.handle,
        reason: "Property mismatch",
        class: "Migration Defect",
      });
    } else {
      report.matches++;
    }
  }

  return report;
}

export async function compareFiles(
  clientA: ShopifyClient,
  clientB: ShopifyClient,
): Promise<ComparisonReport> {
  const report: ComparisonReport = {
    resourceType: "Files",
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    discrepancies: [],
  };

  const query = `{ files(first: 250) { edges { node { id fileStatus ... on MediaImage { image { originalSrc altText } } } } } }`;
  const resA = await clientA.graphql<any>(query);
  const resB = await clientB.graphql<any>(query);

  const filesA = resA.files?.edges?.map((e: any) => e.node) || [];
  const filesB = resB.files?.edges?.map((e: any) => e.node) || [];

  report.resourcesChecked += filesA.length;

  for (const a of filesA) {
    const b = filesB.find((f: any) => f.image?.altText === a.image?.altText);
    if (!b) {
      report.mismatches++;
      report.discrepancies.push({
        resource: "File",
        id: a.id,
        reason: "File missing in destination",
        class: "Migration Defect",
      });
    } else {
      report.matches++;
    }
  }

  return report;
}
