import { test, expect } from '@playwright/test';

/**
 * Smoke test to verify Playwright setup
 * This test doesn't require Convex to be running
 */
test.describe('Playwright Setup', () => {
  test('can load landing page', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/Ice/i);
    
    // Check for room code inputs
    const input0 = page.getByTestId('room-code-input-0');
    await expect(input0).toBeVisible();
  });

  test('can navigate to host page', async ({ page }) => {
    await page.goto('/host');
    
    // Check for create room button
    const createButton = page.getByTestId('create-room-button');
    await expect(createButton).toBeVisible();
  });
});
