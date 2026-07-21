import { explainShopifyLimitation } from "../src/lib/sdk/migration/ai-assistant";

async function main() {
  console.log("Testing NVIDIA AI Assistant Integration...");
  const res = await explainShopifyLimitation({
    resourceType: "payments",
    limitationReason: "Shopify blocks programmatic configuration of payment gateways.",
    extractedConfiguration: {
      supportedDigitalWallets: ["APPLE_PAY", "GOOGLE_PAY"],
      acceptedCardBrands: ["VISA", "MASTERCARD"],
      customManualPaymentMethods: [{ name: "Bank Transfer" }],
    },
  });

  console.log("AI Assistant Result:");
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
