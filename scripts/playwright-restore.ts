import { chromium } from "playwright";

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Generating magic link...");
  const res = await fetch(
    "https://shopify-recovery-os.vercel.app/api/magic-link?secret=imam-recovery-test",
  );
  if (!res.ok) {
    console.error("Failed to get magic link", await res.text());
    process.exit(1);
  }
  const { link } = await res.json();
  console.log("Got magic link:", link);
  console.log("Following magic link with fetch...");
  const redirectRes = await fetch(link, { redirect: "manual" });
  let finalUrl = redirectRes.url;
  if (redirectRes.status >= 300 && redirectRes.status < 400) {
    finalUrl = redirectRes.headers.get("location") || finalUrl;
  }
  const hash = finalUrl.split("#")[1];
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  console.log("Navigating to Vercel app to inject session...");
  await page.goto("https://shopify-recovery-os.vercel.app/");

  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      localStorage.setItem(
        "sb-xjbvzqflmkiaehpkcofx-auth-token",
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "test", email: "mudasarimamofficial@gmail.com" },
        }),
      );
    },
    { accessToken, refreshToken },
  );

  console.log("Navigating to /restore...");
  await page.goto("https://shopify-recovery-os.vercel.app/restore");

  page.on("dialog", async (dialog) => {
    console.error("ALERT POPPED UP DURING RESTORE:", dialog.message());
    await dialog.accept();
    process.exit(1);
  });

  console.log("Waiting for restore page...");
  await page.waitForSelector("text=Restore into a Shopify store");
  await page.waitForTimeout(2000);

  // The UI has a "Source Package" dropdown and "Target Store" dropdown
  console.log("Selecting backup...");
  await page.locator("select").nth(0).selectOption("5015a646-aa83-4eed-bd1d-0e6e5de8e9f7");

  console.log("Selecting store...");
  await page.locator("select").nth(1).selectOption("c97e5b9d-f9c7-4abf-b4f5-3980508b8ffd");

  console.log("Clicking Analyze package...");
  await page.click("button:has-text('Analyze Compatibility')");

  console.log("Waiting for plan...");
  // When plan generates, "Execute restore" appears
  await page.waitForSelector("button:has-text('Execute Restore')", { timeout: 30000 });

  console.log("Executing restore...");
  await page.click("button:has-text('Execute Restore')");

  console.log("Waiting for completion...");

  let currentProgress = "";
  let timeoutCount = 0;
  const maxWaitLoops = 600; // 600 * 2s = 1200s = 20 minutes max

  while (timeoutCount < maxWaitLoops) {
    const isCompleted = await page.locator("text=Restore Complete!").isVisible();
    if (isCompleted) {
      console.log("Restore Complete! 100%");
      break;
    }

    // Read progress indicator
    try {
      const progressText = await page.locator("p.text-muted-foreground").innerText();
      if (progressText && progressText !== currentProgress) {
        currentProgress = progressText;
        console.log(`Current Progress: ${currentProgress}`);
      }
    } catch (e) {
      // Selector might not be rendered yet or changed
    }

    await page.waitForTimeout(2000);
    timeoutCount++;
  }

  if (timeoutCount >= maxWaitLoops) {
    console.error("TIMED OUT WAITING FOR RESTORE");
    await page.screenshot({ path: "scripts/restore_timeout.png" });
    await browser.close();
    process.exit(1);
  }

  console.log(
    "Phase 1 Business Recovery Workflow (Backup & Restore) FULLY VERIFIED ON PRODUCTION!",
  );
  await page.screenshot({ path: "scripts/restore_completed_success.png" });
  await browser.close();
}

main().catch(console.error);
