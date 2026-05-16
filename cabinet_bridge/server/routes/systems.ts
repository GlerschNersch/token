import type { Express } from "express";
import { storage } from "../storage";
import {
  SYSTEM_IMAGE_CACHE_DIR, SYSTEM_LOGO_CACHE_DIR,
  SYSTEM_IMAGE_FETCH_HEADERS, LIBRETRO_PLAYLISTS,
  STEAMGRIDDB_API_KEY, STEAMGRIDDB_PLATFORM_IDS,
} from "./shared";
import { SYSTEM_IMAGES, isSystemImageId } from "@shared/system-images";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * Fetch a hero/background image for a platform from SteamGridDB.
 * Uses the /heroes/platform/:id endpoint, picks the first result.
 */
async function fetchSteamGridDBHero(systemId: string): Promise<Buffer | null> {
  const platformId = STEAMGRIDDB_PLATFORM_IDS[systemId];
  if (!platformId || !STEAMGRIDDB_API_KEY) return null;
  try {
    const searchRes = await fetch(
      `https://www.steamgriddb.com/api/v2/heroes/platform/${platformId}?limit=1`,
      {
        headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!searchRes.ok) return null;
    const json = await searchRes.json() as { success: boolean; data?: Array<{ url: string }> };
    const url = json?.data?.[0]?.url;
    if (!url) return null;
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok || !imgRes.body) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Fetch a logo image for a platform from SteamGridDB.
 * Uses the /logos/platform/:id endpoint, picks the first result.
 */
async function fetchSteamGridDBLogo(systemId: string): Promise<Buffer | null> {
  const platformId = STEAMGRIDDB_PLATFORM_IDS[systemId];
  if (!platformId || !STEAMGRIDDB_API_KEY) return null;
  try {
    const searchRes = await fetch(
      `https://www.steamgriddb.com/api/v2/logos/platform/${platformId}?limit=1`,
      {
        headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!searchRes.ok) return null;
    const json = await searchRes.json() as { success: boolean; data?: Array<{ url: string }> };
    const url = json?.data?.[0]?.url;
    if (!url) return null;
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok || !imgRes.body) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch {
    return null;
  }
}

export function registerSystemRoutes(app: Express) {
  app.get("/api/system-images", (_req, res) => {
    res.json(Object.keys(SYSTEM_IMAGES).map(id => ({ ...SYSTEM_IMAGES[id as keyof typeof SYSTEM_IMAGES], id })));
  });

  app.get("/api/system-images/:id", async (req, res) => {
    const id = req.params.id;
    if (!isSystemImageId(id)) return res.status(404).json({ message: "Invalid system ID" });

    const cachePath = path.join(SYSTEM_IMAGE_CACHE_DIR, `${id}.jpg`);
    if (existsSync(cachePath)) {
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.sendFile(cachePath);
    }

    await fs.mkdir(SYSTEM_IMAGE_CACHE_DIR, { recursive: true });

    // 1. Try SteamGridDB hero image first
    const sgdbBuffer = await fetchSteamGridDBHero(id);
    if (sgdbBuffer) {
      await fs.writeFile(cachePath, sgdbBuffer);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.send(sgdbBuffer);
    }

    // 2. Fall back to Wikimedia Commons
    const config = SYSTEM_IMAGES[id];
    try {
      const upstream = await fetch(config.url, {
        headers: SYSTEM_IMAGE_FETCH_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok || !upstream.body) throw new Error("Upstream failed");
      const buffer = Buffer.from(await upstream.arrayBuffer());
      await fs.writeFile(cachePath, buffer);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.send(buffer);
    } catch {
      res.status(502).json({ message: "Failed to fetch system image" });
    }
  });

  app.get("/api/system-logos/:id", async (req, res) => {
    const id = req.params.id;
    const cachePath = path.join(SYSTEM_LOGO_CACHE_DIR, `${id}.png`);

    if (existsSync(cachePath)) {
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.sendFile(cachePath);
    }

    await fs.mkdir(SYSTEM_LOGO_CACHE_DIR, { recursive: true });

    // 1. Try SteamGridDB logo
    const sgdbLogo = await fetchSteamGridDBLogo(id);
    if (sgdbLogo) {
      await fs.writeFile(cachePath, sgdbLogo);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.send(sgdbLogo);
    }

    // 2. Fall back to libretro assets
    const playlistName = LIBRETRO_PLAYLISTS[id];
    if (playlistName) {
      try {
        const logoUrl = `https://raw.githubusercontent.com/libretro/libretro-assets/master/xmb/monochrome/png/${encodeURIComponent(playlistName)}.png`;
        const response = await fetch(logoUrl, { signal: AbortSignal.timeout(3000) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          await fs.writeFile(cachePath, buffer);
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=604800");
          return res.send(buffer);
        }
      } catch {
        // Intentionally silent — 404 below triggers ConsoleSilhouette fallback on client
      }
    }

    res.status(404).json({ message: "Logo not found" });
  });
}
