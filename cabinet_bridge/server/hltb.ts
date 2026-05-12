/**
 * HowLongToBeat integration
 *
 * Wraps the `howlongtobeat` npm package with a SQLite-backed cache so we only
 * hit the HLTB servers once per ROM (refreshed after 7 days or on demand).
 *
 * Times from HLTB come back in fractional hours; we store them as whole
 * minutes to match the existing `minutes_played` convention throughout the app.
 */

import { createRequire } from 'module';
import { storage } from './storage.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HowLongToBeatService } = require('howlongtobeat') as any;

const hltbService = new HowLongToBeatService();

/** 7-day TTL for cached results */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface HltbResult {
  romId: number;
  hltbTitle: string | null;
  /** Minutes for main story, or null if HLTB has no data */
  mainStory: number | null;
  /** Minutes for main story + extras */
  mainExtra: number | null;
  /** Minutes for 100% completion */
  completionist: number | null;
  cachedAt: number;
}

/**
 * Returns HLTB times for a ROM, using the SQLite cache when fresh.
 * Pass `forceRefresh = true` to bypass the cache.
 */
export async function getHltbData(
  romId: number,
  title: string,
  forceRefresh = false,
): Promise<HltbResult | null> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await storage.getHltbCache(romId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached;
    }
  }

  // Fetch from HLTB
  try {
    const results = await hltbService.search(title);
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }
    const best = results[0];
    const data: HltbResult = {
      romId,
      hltbTitle: best.name ?? null,
      mainStory: best.gameplayMain ? Math.round(best.gameplayMain * 60) : null,
      mainExtra: best.gameplayMainExtra ? Math.round(best.gameplayMainExtra * 60) : null,
      completionist: best.gameplayCompletionist ? Math.round(best.gameplayCompletionist * 60) : null,
      cachedAt: Date.now(),
    };
    await storage.saveHltbCache(data);
    return data;
  } catch (err) {
    console.error('[HLTB] fetch error:', err);
    return null;
  }
}

/** Formats a minutes value as a human-readable string, e.g. "8½h" or "45m" */
export function formatHltbTime(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  // Round to nearest half-hour for display cleanliness
  return m >= 45 ? `${h + 1}h` : m >= 15 ? `${h}½h` : `${h}h`;
}
