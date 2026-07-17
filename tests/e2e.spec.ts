import { test, expect } from '@playwright/test';

test.describe('Authentication & Core Workflows', () => {
  test('Redirects to auth when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/auth/);
  });

  test('Renders auth page correctly', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h1')).toContainText('Welcome back.');
    await expect(page.locator('text=Imam Recovery OS').first()).toBeVisible();
    
    // Switch to signup (retry if hydration misses the first click)
    await expect(async () => {
      await page.locator('button:has-text("Create one")').click();
      await expect(page.locator('h1')).toContainText('Get started in seconds.');
    }).toPass();
    
    // Switch to forgot password (retry if hydration misses the click)
    await expect(async () => {
      await page.locator('button:has-text("Sign in")').click();
      await page.locator('button:has-text("Forgot?")').click();
      await expect(page.locator('h1')).toContainText('Forgot your password?');
    }).toPass();
  });

  test('Public landing page renders without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
