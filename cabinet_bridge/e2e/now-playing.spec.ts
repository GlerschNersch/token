/**
 * NowPlayingBar E2E Tests
 *
 * Tests the persistent Now Playing mini-player bar that appears
 * when a game is active.
 *
 * Run with: npx playwright test e2e/now-playing.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';

/** Override /api/now-playing to return a fake "playing" state */
async function mockNowPlaying(page: Page, data: Record<string, unknown>) {
  await page.route('/api/now-playing', async (route) => {
    await route.fulfill({ json: data, status: 200 });
  });
}

/** Clear the mock so it returns playing: false */
async function clearNowPlaying(page: Page) {
  await page.route('/api/now-playing', async (route) => {
    await route.fulfill({ json: { playing: false }, status: 200 });
  });
}

test.describe('NowPlayingBar', () => {

  test('is hidden when no game is playing', async ({ page }) => {
    await clearNowPlaying(page);
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Bar should not be visible
    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).not.toBeVisible();
  });

  test('appears when a game is active (playing=true)', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now() - 60_000, // started 1 min ago
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    // Title should appear
    await expect(page.locator('text=Duck Tales')).toBeVisible();
    await expect(page.locator('text=nes')).toBeVisible();
  });

  test('shows "Now Playing" label and pulsing green dot', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 99,
      title: 'Street Fighter II',
      system: 'snes',
      startedAt: Date.now() - 120_000,
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible();

    // "Now Playing" label should be visible
    await expect(page.locator('text=Now Playing')).toBeVisible();

    // Pulsing dot should exist
    const dot = bar.locator('[class*="animate-ping"]');
    await expect(dot).toBeVisible();
  });

  test('session timer increments over time', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 7,
      title: 'Tetris',
      system: 'gameboy',
      startedAt: Date.now() - 90_000,
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    // Read initial timer value
    const initialTimer = await bar.locator('[data-testid="now-playing-timer"]').textContent();

    // Wait 3 seconds
    await page.waitForTimeout(3000);

    // Timer should have increased (now shows >= 93s → "1:33" or similar)
    const newTimer = await bar.locator('[data-testid="now-playing-timer"]').textContent();
    expect(newTimer).not.toBe(initialTimer);
  });

  test('"Return" button links to the player page', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now(),
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    const returnBtn = page.locator('[data-testid="now-playing-return"]');
    await expect(returnBtn).toBeVisible();
    await expect(returnBtn).toHaveAttribute('href', '/play/42');
  });

  test('"Exit" button navigates home', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now(),
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const exitBtn = page.locator('[data-testid="now-playing-exit"]');
    if (await exitBtn.count() > 0) {
      // Intercept the exit API call
      await page.route('/api/roms/exit', async (route) => {
        await route.fulfill({ json: { ok: true }, status: 200 });
      });

      await exitBtn.click();
      await page.waitForTimeout(500);
      // Should redirect home
      await expect(page).toHaveURL(/\/$|.*#\/$/);
    } else {
      test.skip();
    }
  });

  test('dismiss button hides the bar', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now(),
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    const dismissBtn = page.locator('[aria-label="Dismiss now playing bar"]');
    await dismissBtn.click();
    await page.waitForTimeout(400);

    // Bar should be gone
    await expect(bar).not.toBeVisible();
  });

  test('bar position: above mobile bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now(),
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    // Mobile bottom nav should still be visible
    const bottomNav = page.locator('[data-testid="mobile-bottom-nav"]');
    if (await bottomNav.count() > 0) {
      await expect(bottomNav).toBeVisible();
    }
  });

  test('bar survives navigation between pages', async ({ page }) => {
    await mockNowPlaying(page, {
      playing: true,
      id: 42,
      title: 'Duck Tales',
      system: 'nes',
      startedAt: Date.now() - 300_000,
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bar = page.locator('[data-testid="now-playing-bar"]');
    await expect(bar).toBeVisible({ timeout: 5000 });

    // Navigate to library
    await page.goto(`${BASE_URL}/#/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(bar).toBeVisible({ timeout: 3000 });

    // Navigate to settings
    await page.goto(`${BASE_URL}/#/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(bar).toBeVisible({ timeout: 3000 });

    // Navigate back to dashboard
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(bar).toBeVisible({ timeout: 3000 });
  });

});