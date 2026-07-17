# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Authentication & Core Workflows >> Renders auth page correctly
- Location: tests\e2e.spec.ts:9:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Get started in seconds."
Received string:    "Welcome back."
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1')
    14 × locator resolved to <h1 class="mt-2 text-2xl font-semibold tracking-tight">Welcome back.</h1>
       - unexpected value "Welcome back."

```

```yaml
- heading "Welcome back." [level=1]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Authentication & Core Workflows', () => {
  4  |   test('Redirects to auth when unauthenticated', async ({ page }) => {
  5  |     await page.goto('/dashboard');
  6  |     await expect(page).toHaveURL(/.*\/auth/);
  7  |   });
  8  | 
  9  |   test('Renders auth page correctly', async ({ page }) => {
  10 |     await page.goto('/auth');
  11 |     await expect(page.locator('h1')).toContainText('Welcome back.');
  12 |     await expect(page.locator('text=Imam Recovery OS').first()).toBeVisible();
  13 |     
  14 |     // Switch to signup
  15 |     await page.click('button:has-text("Create one")');
> 16 |     await expect(page.locator('h1')).toContainText('Get started in seconds.');
     |                                      ^ Error: expect(locator).toContainText(expected) failed
  17 |     
  18 |     // Switch to forgot password
  19 |     await page.click('button:has-text("Sign in")');
  20 |     await page.click('button:has-text("Forgot?")');
  21 |     await expect(page.locator('h1')).toContainText('Forgot your password?');
  22 |   });
  23 | 
  24 |   test('Public landing page renders without errors', async ({ page }) => {
  25 |     await page.goto('/');
  26 |     await expect(page.locator('h1').first()).toBeVisible();
  27 |   });
  28 | });
  29 | 
```