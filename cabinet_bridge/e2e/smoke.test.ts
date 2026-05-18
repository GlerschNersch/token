import { test, expect } from '@playwright/test';

test('HomeArcade smoke test', async ({ page }) => {
  await page.goto('http://localhost:5000');
  
  await expect(page).toHaveTitle(/HomeArcade/i);

  // Handle the welcome modal if it appears
  const getStartedButton = page.locator('button:has-text("Get started")');
  if (await getStartedButton.isVisible()) {
    await getStartedButton.click();
  }
  
  // Check for the dashboard elements
  await expect(page.locator('a').filter({ hasText: 'Dashboard' })).toBeVisible();
  
  // Check for seeded ROMs
  await expect(page.locator('text=DuckTales 2').first()).toBeVisible();
  
  // Check for some sidebar systems
  await expect(page.getByText('NES', { exact: true }).first()).toBeVisible();
});
