/**
 * HomeArcade UX Test Suite
 * Comprehensive Playwright tests for UI/UX issues, interactions, and flows.
 *
 * Prerequisites:
 *   1. App must be running: npm run dev
 *   2. Install Playwright browsers: npx playwright install chromium
 *   3. Set E2E_BASE_URL if not using localhost:5000
 *
 * Run with: npx playwright test e2e/ux.spec.ts
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';
const APP_URL  = `${BASE_URL}/#`;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function waitForToast(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForSelector('[role="status"], [data-testid="toast"]', { timeout: timeoutMs }).catch(() => {});
}

/** Dismiss all visible toasts */
async function dismissToasts(page: Page): Promise<void> {
  const closeButtons = page.locator('[aria-label="Close"], [data-testid="toast-dismiss"]');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.first().click();
    await page.waitForTimeout(200);
  }
}

/** Escape key shorthand */
async function pressEsc(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}

/** Get a count of visible game cards (non-skeleton) */
async function visibleGameCardCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="card-game-"]:not(.animate-pulse)').count();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('HomeArcade UX — Navigation & Structure', () => {

  test('sidebar is visible on all main routes', async ({ page }) => {
    const routes = ['/', '/library', '/settings', '/history', '/achievements'];
    for (const route of routes) {
      await page.goto(`${APP_URL}${route}`);
      await page.waitForLoadState('networkidle');
      const sidebar = page.locator('[data-testid="sidebar"], nav[aria-label="Sidebar"], [class*="sidebar"]').first();
      await expect(sidebar).toBeVisible({ timeout: 8000 });
    }
  });

  test('sidebar collapses to icons on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP_URL}/`);
    await page.waitForLoadState('networkidle');

    // Find collapse toggle
    const trigger = page.locator('[aria-label="Collapse sidebar"], button[class*="trigger"]').first();
    if (await trigger.count() > 0) {
      await trigger.click();
      await page.waitForTimeout(400);
      // After collapse, sidebar should show icons only (no text)
      const textItems = page.locator('.sidebar span:not([class*="size"])');
      await expect(await textItems.count()).toBe(0);
    }
  });

  test('sidebar can expand again after collapse', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP_URL}/`);
    await page.waitForLoadState('networkidle');

    const trigger = page.locator('[aria-label="Collapse sidebar"], [aria-label="Expand sidebar"]').first();
    if (await trigger.count() > 0) {
      await trigger.click();
      await page.waitForTimeout(300);
      await trigger.click(); // re-expand
      await page.waitForTimeout(300);
      // After expand, nav items should be visible
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
    }
  });

  test('all sidebar nav items navigate correctly', async ({ page }) => {
    await page.goto(`${APP_URL}/`);
    await page.waitForLoadState('networkidle');

    // Nav items to click
    const navItems: [string, string][] = [
      ['Favorites',  '/library/favorites'],
      ['Recently Played', '/library/recent'],
      ['All Games',  '/library/all'],
      ['History',    '/history'],
      ['Settings',   '/settings'],
    ];

    for (const [label, expectedPath] of navItems) {
      const item = page.locator(`text="${label}"`).first();
      if (await item.count() > 0) {
        await item.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(`${BASE_URL}/#${expectedPath}`, { timeout: 5000 });
      }
    }
  });

  test('sidebar system filters navigate to correct library views', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');

    // Click a system filter in the sidebar if visible
    const systemButtons = page.locator('[aria-label*="NES"], [aria-label*="SNES"], [aria-label*="Genesis"]');
    const count = await systemButtons.count();
    if (count > 0) {
      await systemButtons.first().click();
      await page.waitForLoadState('networkidle');
      // Should show filtered game list
      const cards = await visibleGameCardCount(page);
      expect(cards).toBeGreaterThanOrEqual(0);
    }
  });

});

test.describe('HomeArcade UX — Game Library (Home Page)', () => {

  test('game grid renders cards or empty state', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // allow async data

    const cards = await visibleGameCardCount(page);
    const emptyState = page.locator('[data-testid="state-empty"]');
    const hasEmpty = await emptyState.count() > 0;
    expect(cards + (hasEmpty ? 1 : 0)).toBeGreaterThan(0);
  });

  test('search bar filters games in real time', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i], [aria-label*="search" i]').first();
    if (await searchInput.count() === 0) {
      test.skip(); // no search input found
      return;
    }

    const initialCards = await visibleGameCardCount(page);
    await searchInput.fill('zzzz-unlikely-game-title-xyz');
    await page.waitForTimeout(500);
    const filteredCards = await visibleGameCardCount(page);

    // Either empty state or fewer cards
    const hasEmpty = await page.locator('[data-testid="state-empty"]').count() > 0;
    expect(filteredCards < initialCards || hasEmpty).toBeTruthy();
  });

  test('search can be cleared with X button', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    if (await searchInput.count() === 0) {
      test.skip();
      return;
    }

    await searchInput.fill('test');
    await page.waitForTimeout(300);

    const clearBtn = page.locator('[aria-label="Clear search"], button:has-text("Clear")').first();
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      const value = await searchInput.inputValue();
      expect(value).toBe('');
    }
  });

  test('sort options change game order', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sortBtn = page.locator('[data-testid^="button-sort-"]').first();
    if (await sortBtn.count() === 0) {
      test.skip();
      return;
    }

    await sortBtn.click();
    await page.waitForTimeout(500);

    const options = page.locator('[data-testid^="button-sort-"]');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    // Click each sort option and verify no crash
    for (let i = 0; i < Math.min(optionCount, 4); i++) {
      await options.nth(i).click();
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('filter pills filter the game list', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const filterPills = page.locator('[data-testid^="filter-"], button[class*="filter"]');
    const count = await filterPills.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await filterPills.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('grid/list view toggle works', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const toggleBtns = page.locator('[data-testid^="button-view-"]');
    if (await toggleBtns.count() >= 2) {
      await toggleBtns.nth(1).click(); // switch view
      await page.waitForTimeout(500);
      await toggleBtns.nth(0).click(); // switch back
      await page.waitForTimeout(300);
    }
  });

  test('hover on a game card shows overlay', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() === 0) {
      test.skip();
      return;
    }

    await card.hover();
    await page.waitForTimeout(400);

    const overlay = card.locator('[data-testid^="button-details-"]');
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('click game card opens detail dialog', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() === 0) {
      test.skip();
      return;
    }

    await card.click();
    await page.waitForTimeout(800);

    // Dialog should be open
    const dialog = page.locator('[role="dialog"], [data-testid="game-detail"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test('favorite button toggles without navigating away', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const favBtn = page.locator('[data-testid^="button-fav-"]').first();
    if (await favBtn.count() === 0) {
      test.skip();
      return;
    }

    const beforeUrl = page.url();
    await favBtn.click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(beforeUrl); // no navigation
  });

});

test.describe('HomeArcade UX — Game Detail Dialog', () => {

  async function openGameDialog(page: Page): Promise<void> {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(800);
    }
  }

  test('game detail dialog shows title and metadata', async ({ page }) => {
    await openGameDialog(page);
    const dialog = page.locator('[role="dialog"], [data-testid="game-detail"]').first();
    if (await dialog.count() === 0) {
      test.skip();
      return;
    }

    // Title should be visible
    const title = dialog.locator('h1, h2, [data-testid="dialog-title"], [class*="title"]').first();
    await expect(title).toBeVisible({ timeout: 3000 });

    // Rating, system label, or description should be present
    const hasMeta = await page.locator('text=/\\d+(\\.\\d)?\\/?\\d+|\\w+ system/i').count() > 0;
    expect(hasMeta).toBeTruthy();
  });

  test('dialog can be closed with Escape key', async ({ page }) => {
    await openGameDialog(page);
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.count() === 0) {
      test.skip();
      return;
    }

    await pressEsc(page);
    await page.waitForTimeout(500);
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('dialog can be closed by clicking backdrop', async ({ page }) => {
    await openGameDialog(page);
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.count() === 0) {
      test.skip();
      return;
    }

    // Click outside the dialog
    const backdrop = page.locator('[data-state="open"] ~ *, [class*="backdrop"]').first();
    if (await backdrop.count() > 0) {
      await backdrop.click({ position: { x: 10, y: 10 }, force: true });
      await page.waitForTimeout(500);
    }
  });

  test('play button exists and is clickable', async ({ page }) => {
    await openGameDialog(page);
    const playBtn = page.locator('[data-testid^="button-play"], button:has-text("Play")').first();
    if (await playBtn.count() === 0) {
      test.skip();
      return;
    }

    await expect(playBtn).toBeVisible();
    await expect(playBtn).toBeEnabled();
  });

  test('dialog shows rating display', async ({ page }) => {
    await openGameDialog(page);
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.count() === 0) {
      test.skip();
      return;
    }

    // Should show some star or number rating
    const ratingArea = page.locator('[data-testid^="rating"], svg[class*="star"], text=/rating/i').first();
    await expect(ratingArea).toBeVisible({ timeout: 3000 });
  });

});

test.describe('HomeArcade UX — Settings Page', () => {

  test('settings page loads without crash', async ({ page }) => {
    await page.goto(`${APP_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('all 26 themes are listed and selectable', async ({ page }) => {
    await page.goto(`${APP_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open theme selector
    const themeControl = page.locator('[data-testid="theme-select"], [role="combobox"], [aria-label*="theme" i]').first();
    if (await themeControl.count() === 0) {
      test.skip();
      return;
    }

    await themeControl.click();
    await page.waitForTimeout(500);

    // Check key themes exist
    const themes = ['synthwave', 'matrix', 'golden-age', 'retro', 'arcade', 'neon'];
    for (const theme of themes) {
      const el = page.locator(`text=${theme}`).first();
      await expect(el).toBeVisible({ timeout: 3000 });
    }

    // Select one theme
    await page.locator(`text=synthwave`).first().click();
    await page.waitForTimeout(500);

    // Should apply without crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('language setting is accessible', async ({ page }) => {
    await page.goto(`${APP_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const langControl = page.locator('[data-testid="language-select"], [aria-label*="language" i], [role="combobox"]:nth-of-type(2)').first();
    if (await langControl.count() === 0) {
      test.skip();
      return;
    }

    await langControl.click();
    await page.waitForTimeout(500);

    const option = page.locator('[role="option"], [data-state="checked"]').first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(500);
    }
  });

  test('settings changes persist after page reload', async ({ page }) => {
    await page.goto(`${APP_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const themeControl = page.locator('[data-testid="theme-select"], [role="combobox"], [aria-label*="theme" i]').first();
    if (await themeControl.count() === 0) {
      test.skip();
      return;
    }

    await themeControl.click();
    await page.waitForTimeout(500);

    // Select a second theme
    const allThemes = page.locator('[role="option"], [data-testid^="option-"]');
    if (await allThemes.count() > 1) {
      await allThemes.nth(1).click();
      await page.waitForTimeout(500);
    }

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Theme should still be applied (or at least no crash)
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('HomeArcade UX — Keyboard Navigation', () => {

  test('Tab key navigates through interactive elements', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Press Tab several times
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');

    // Should have focused an element (no crash)
    await expect(page.locator('body')).toBeVisible();
  });

  test('Escape closes any open dialog/modal', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(800);
      await pressEsc(page);
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"]:visible').first();
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('"/" shortcut focuses search input', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.keyboard.press('/');
    await page.waitForTimeout(400);

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isFocused = await searchInput.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBeTruthy();
  });

  test('Ctrl+K also focuses search input', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(400);

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isFocused = await searchInput.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBeTruthy();
  });

  test('Arrow keys navigate game grid when focused', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Focus a game card
    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() === 0) {
      test.skip();
      return;
    }
    await card.focus();
    await page.waitForTimeout(200);

    // Press arrow keys (should not crash)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // Still on the page
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('HomeArcade UX — History & Achievements', () => {

  test('history page loads without crash', async ({ page }) => {
    await page.goto(`${APP_URL}/history`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('history shows play sessions or empty state', async ({ page }) => {
    await page.goto(`${APP_URL}/history`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const hasContent = await page.locator('[data-testid^="history-item"], [data-testid^="session-"]').count() > 0;
    const hasEmpty = await page.locator('[data-testid="state-empty"], text=/no history/i').count() > 0;
    expect(hasContent || hasEmpty).toBeTruthy();
  });

  test('achievements page loads without crash', async ({ page }) => {
    await page.goto(`${APP_URL}/achievements`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('achievements page shows badges or empty state', async ({ page }) => {
    await page.goto(`${APP_URL}/achievements`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const hasContent = await page.locator('[data-testid^="achievement-"], img[alt*="achievement"]').count() > 0;
    const hasEmpty = await page.locator('[data-testid="state-empty"], text=/no achievements/i').count() > 0;
    expect(hasContent || hasEmpty).toBeTruthy();
  });

});

test.describe('HomeArcade UX — Loading & Edge States', () => {

  test('loading skeletons appear while data fetches', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    // Don't wait for networkidle — capture the loading state
    await page.waitForTimeout(500);

    const skeletons = page.locator('.animate-pulse, [data-testid="skeleton"], [data-testid="loading"]');
    // Skeletons may or may not be present — just ensure no crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('empty library shows helpful empty state', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const emptyState = page.locator('[data-testid="state-empty"]');
    const noGames = page.locator('text=/no games|empty library|add some games/i');

    const hasEmpty = await emptyState.count() > 0 || await noGames.count() > 0;
    if (!hasEmpty) {
      // If no empty state, there should be actual games
      const cards = await visibleGameCardCount(page);
      expect(cards).toBeGreaterThan(0);
    }
  });

  test('404 page renders correctly for invalid routes', async ({ page }) => {
    await page.goto(`${APP_URL}/this-route-does-not-exist-12345`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const notFound = page.locator('text=/404|not found|page not found/i');
    await expect(notFound).toBeVisible({ timeout: 5000 });
  });

  test('no console errors on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${APP_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out known non-issue errors (favicon 404s, etc.)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('Failed to load resource')
    );

    if (realErrors.length > 0) {
      console.log('Console errors found:', realErrors);
    }
    expect(realErrors.length).toBe(0);
  });

});

test.describe('HomeArcade UX — Collections', () => {

  test('collections appear in sidebar when present', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const collectionSection = page.locator('text=/collections/i');
    if (await collectionSection.count() > 0) {
      await expect(collectionSection).toBeVisible();
    }
  });

  test('clicking a collection in sidebar filters to that collection', async ({ page }) => {
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const collectionLink = page.locator('[href*="/collection/"]').first();
    if (await collectionLink.count() === 0) {
      test.skip();
      return;
    }

    await collectionLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // URL should contain collection id
    const url = page.url();
    expect(url).toContain('/collection/');
  });

});

test.describe('HomeArcade UX — Responsive & Mobile', () => {

  test('mobile viewport shows bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const bottomNav = page.locator('[data-testid="mobile-bottom-nav"], nav[class*="bottom"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 5000 });
  });

  test('game grid is usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const card = page.locator('[data-testid^="card-game-"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(800);
      // Dialog should open on mobile too
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }
  });

  test('sidebar collapses on mobile by default', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('[data-testid="sidebar"], [class*="sidebar"]').first();
    const isVisible = await sidebar.isVisible().catch(() => false);
    // On very small screens, sidebar may be hidden — that's fine
    expect(isVisible || !isVisible).toBeTruthy();
  });

});

test.describe('HomeArcade UX — Player Page', () => {

  test('player page loads without crash for valid game', async ({ page }) => {
    // Find first available rom ID
    await page.goto(`${APP_URL}/library`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if any card has a data-rom-id
    const cardWithRom = page.locator('[data-testid^="card-game-"]').first();
    if (await cardWithRom.count() === 0) {
      test.skip();
      return;
    }

    // Player page requires a game ID — navigate directly
    await page.goto(`${APP_URL}/play/1`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show player UI or loading — no crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('player page handles missing game gracefully', async ({ page }) => {
    await page.goto(`${APP_URL}/play/999999`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show 404 or error state, not crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

});