import { connectShopifyStore } from "./src/lib/shopify.functions";

async function run() {
  try {
    const res = await connectShopifyStore({
      data: {
        shop_domain: "test-pipeline-store.myshopify.com",
        access_token: "shpat_test123",
      },
      context: {
        userId: "4d59d21a-b411-4f5c-b33b-b2d85428ac6f",
      } as any,
    });
    console.log(res);
  } catch (e: any) {
    console.error("FAILED:", e.message);
  }
}
run();
