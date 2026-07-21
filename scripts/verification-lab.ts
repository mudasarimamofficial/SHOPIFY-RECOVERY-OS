import { makeShopifyClient } from "../src/lib/shopify.server";
import {
  compareProducts,
  compareCollections,
  compareCustomers,
} from "../src/lib/sdk/verification/compare";
import { generateRecoveryCertificate } from "../src/lib/sdk/verification/certificate";
import fs from "node:fs";

export type StoreProfile =
  | "Empty"
  | "Small"
  | "Medium"
  | "Large"
  | "B2B"
  | "Multi-language"
  | "Markets"
  | "Metaobjects-heavy"
  | "Theme-heavy";

async function runLab() {
  const domainA = process.env.STORE_A_DOMAIN;
  const tokenA = process.env.STORE_A_TOKEN;
  const domainB = process.env.STORE_B_DOMAIN;
  const tokenB = process.env.STORE_B_TOKEN;

  if (!domainA || !tokenA || !domainB || !tokenB) {
    console.error(
      "V2 Verification Lab Requires: STORE_A_DOMAIN, STORE_A_TOKEN, STORE_B_DOMAIN, STORE_B_TOKEN env vars.",
    );
    console.error(
      "Please provide valid Admin API Access Tokens (shpat_...) and .myshopify.com domains for both Store A and Store B so I can begin the Live Migration Evidence Phase.",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const profileArgIndex = args.indexOf("--profile");
  const profile: StoreProfile =
    profileArgIndex !== -1 && args[profileArgIndex + 1]
      ? (args[profileArgIndex + 1] as StoreProfile)
      : "Small";

  const validProfiles: StoreProfile[] = [
    "Empty",
    "Small",
    "Medium",
    "Large",
    "B2B",
    "Multi-language",
    "Markets",
    "Metaobjects-heavy",
    "Theme-heavy",
  ];
  if (!validProfiles.includes(profile)) {
    console.error(`Invalid profile: ${profile}. Must be one of: ${validProfiles.join(", ")}`);
    process.exit(1);
  }

  const clientA = makeShopifyClient(domainA, tokenA);
  const clientB = makeShopifyClient(domainB, tokenB);

  console.log("========================================");
  console.log(`V2 VERIFICATION LAB BOOTING`);
  console.log(`Testing Profile: ${profile}`);
  console.log(`Source: ${domainA}`);
  console.log(`Destination: ${domainB}`);
  console.log("========================================");

  const startTime = new Date();

  // In a real automated pipeline, the backup -> restore processes would be triggered here via API or SDK calls.
  // We assume the migration has just completed, and we are now verifying the output.

  console.log("Running Deep Comparison Engine...");

  const [prodReport, colReport, cusReport] = await Promise.all([
    compareProducts(clientA, clientB),
    compareCollections(clientA, clientB),
    compareCustomers(clientA, clientB),
  ]);

  const endTime = new Date();

  const certificate = generateRecoveryCertificate(
    `mig_${profile.toLowerCase()}_001`,
    `backup_lab_${profile.toLowerCase()}`,
    `job_lab_${profile.toLowerCase()}`,
    domainA,
    domainB,
    startTime,
    endTime,
    [prodReport, colReport, cusReport],
  );

  console.log(`\n✅ VERIFICATION COMPLETE`);
  console.log(`Total Objects Checked: ${certificate.totalObjects}`);
  console.log(`Overall Accuracy: ${certificate.overallAccuracy.toFixed(2)}%`);
  console.log(`Certificate Signature: ${certificate.signature}`);

  const totalMismatches = certificate.reports.reduce((acc, r) => acc + r.mismatches, 0);
  console.log(`Total Discrepancies: ${totalMismatches}`);

  const certFileName = `Recovery_Certificate_${profile.replace(/[^a-zA-Z0-9-]/g, "_")}.json`;
  fs.writeFileSync(certFileName, JSON.stringify(certificate, null, 2));
  console.log(`\nCertificate persisted to ${certFileName}`);

  if (certificate.overallAccuracy < 100) {
    console.error(`❌ Mismatches found! See ${certFileName} for details.`);
    process.exit(1);
  } else {
    console.log("✅ 100% PERFECT MATCH!");
    process.exit(0);
  }
}

runLab().catch((err) => {
  console.error("Lab Failure:", err);
  process.exit(1);
});
