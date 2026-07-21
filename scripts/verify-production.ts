async function verify() {
  const PROD_URL = "https://shopify-recovery-ds3pwxk4g.vercel.app";
  console.log(`Starting Production Runtime Verification for ${PROD_URL}`);

  try {
    const res = await fetch(PROD_URL);
    console.log(`[Health] / => ${res.status} ${res.statusText}`);
    
    const apiRes = await fetch(`${PROD_URL}/api/auth/shopify/callback`);
    console.log(`[Shopify Auth Route] /api/auth/shopify/callback => ${apiRes.status} ${apiRes.statusText}`);
    
    // We expect this to fail gracefully (e.g. 400 Bad Request) rather than crash the server with 500
    const backupRes = await fetch(`${PROD_URL}/api/backup`, { method: "POST" });
    console.log(`[Backup Route] /api/backup => ${backupRes.status} ${backupRes.statusText}`);

    console.log("Telemetry collected successfully.");
  } catch (err) {
    console.error("Verification failed:", err);
  }
}
verify();
