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
    
    // Switch to signup
    await page.click('button:has-text("Create one")');
    await expect(page.locator('h1')).toContainText('Get started in seconds.');
    
    // Switch to forgot password
    await page.click('button:has-text("Return to sign in")');
    await page.click('button:has-text("Forgot?")');
    await expect(page.locator('h1')).toContainText('Forgot your password?');
  });

  test('Public landing page renders without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
