import { makeShopifyClient } from "../src/lib/shopify.server";
import fs from "fs";
import crypto from "crypto";

async function main() {
  const domainA = process.argv[2];
  const tokenA = process.argv[3];
  const domainB = process.argv[4];
  const tokenB = process.argv[5];

  if (!domainA || !tokenA || !domainB || !tokenB) {
    console.error("Usage: bun run scripts/deep-compare.ts <domainA> <tokenA> <domainB> <tokenB>");
    process.exit(1);
  }

  const clientA = makeShopifyClient(domainA, tokenA);
  const clientB = makeShopifyClient(domainB, tokenB);

  console.log(`Starting Deep Verification: ${domainA} -> ${domainB}`);
  const startTime = new Date();

  const report = {
    sourceStore: domainA,
    destinationStore: domainB,
    startTime: startTime.toISOString(),
    finishTime: "",
    durationMs: 0,
    resourcesChecked: 0,
    matches: 0,
    mismatches: 0,
    accuracy: 100,
    discrepancies: [] as any[],
  };

  try {
    // 1. Verify Products
    const resA = await clientA.graphql<any>(
      `{ products(first: 250) { edges { node { handle title status vendor productType tags variants(first: 50) { edges { node { title sku barcode price compareAtPrice weight inventoryQuantity } } } } } } }`,
    );
    const resB = await clientB.graphql<any>(
      `{ products(first: 250) { edges { node { handle title status vendor productType tags variants(first: 50) { edges { node { title sku barcode price compareAtPrice weight inventoryQuantity } } } } } } }`,
    );

    const prodA = resA.products?.edges?.map((e: any) => e.node) || [];
    const prodB = resB.products?.edges?.map((e: any) => e.node) || [];

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
      if (a.title !== b.title) {
        pMatch = false;
        report.discrepancies.push({
          resource: "Product",
          id: a.handle,
          reason: `Title mismatch: ${a.title} != ${b.title}`,
          class: "Migration Defect",
        });
      }
      if (a.status !== b.status) {
        pMatch = false;
        report.discrepancies.push({
          resource: "Product",
          id: a.handle,
          reason: `Status mismatch`,
          class: "Migration Defect",
        });
      }
      if (a.vendor !== b.vendor) {
        pMatch = false;
        report.discrepancies.push({
          resource: "Product",
          id: a.handle,
          reason: `Vendor mismatch`,
          class: "Migration Defect",
        });
      }
      if (a.productType !== b.productType) {
        pMatch = false;
        report.discrepancies.push({
          resource: "Product",
          id: a.handle,
          reason: `Type mismatch`,
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
        if (vA.price !== vB.price) {
          pMatch = false;
          report.discrepancies.push({
            resource: "ProductVariant",
            id: vA.sku,
            reason: `Price mismatch: ${vA.price} != ${vB.price}`,
            class: "Migration Defect",
          });
        }
        if (vA.barcode !== vB.barcode) {
          pMatch = false;
          report.discrepancies.push({
            resource: "ProductVariant",
            id: vA.sku,
            reason: `Barcode mismatch`,
            class: "Migration Defect",
          });
        }
      }

      if (pMatch) report.matches++;
    }

    // 2. Wrap up Certificate
    const endTime = new Date();
    report.finishTime = endTime.toISOString();
    report.durationMs = endTime.getTime() - startTime.getTime();

    report.accuracy =
      report.resourcesChecked === 0 ? 100 : (report.matches / report.resourcesChecked) * 100;

    const certString = JSON.stringify(report, null, 2);
    const hash = crypto.createHash("sha256").update(certString).digest("hex");

    const certificate = {
      ...report,
      certificateHash: hash,
      verifiedAt: report.finishTime,
    };

    fs.writeFileSync("Recovery_Certificate.json", JSON.stringify(certificate, null, 2));
    console.log(`\n======================================`);
    console.log(`✅ RECOVERY CERTIFICATE GENERATED`);
    console.log(`Accuracy: ${report.accuracy.toFixed(2)}%`);
    console.log(`Mismatches: ${report.mismatches}`);
    console.log(`Hash: ${hash}`);
    console.log(`Saved to Recovery_Certificate.json`);
    console.log(`======================================\n`);
  } catch (err: any) {
    console.error("Deep compare failed:", err.message);
  }
}

main().catch(console.error);
