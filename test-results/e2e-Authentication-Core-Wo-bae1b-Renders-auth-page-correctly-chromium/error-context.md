# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Authentication & Core Workflows >> Renders auth page correctly
- Location: tests\e2e.spec.ts:9:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Return to sign in")')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - link "Imam Recovery OS" [ref=e4] [cursor=pointer]:
      - /url: /
      - img [ref=e5]
      - generic [ref=e8]: Imam Recovery OS
    - generic [ref=e9]:
      - generic [ref=e10]: Create account
      - heading "Get started in seconds." [level=1] [ref=e11]
      - paragraph [ref=e12]: Set up an account to connect your first Shopify store.
      - button "Continue with Google" [ref=e13]:
        - img [ref=e14]
        - text: Continue with Google
      - generic [ref=e21]: OR
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]: Email
          - textbox "you@company.com" [ref=e26]
        - generic [ref=e27]:
          - generic [ref=e29]: Password
          - textbox "••••••••" [ref=e30]
        - button "Create account" [ref=e31]
      - generic [ref=e32]:
        - text: Already have one?
        - button "Sign in" [active] [ref=e33]
  - region "Notifications alt+T"
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
  16 |     await expect(page.locator('h1')).toContainText('Get started in seconds.');
  17 |     
  18 |     // Switch to forgot password
> 19 |     await page.click('button:has-text("Return to sign in")');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
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