import type { Express } from "express";
import { storage } from "../storage";
import { 
  SYSTEM_IMAGE_CACHE_DIR, SYSTEM_LOGO_CACHE_DIR, 
  SYSTEM_IMAGE_FETCH_HEADERS, LIBRETRO_PLAYLISTS
} from "./shared";
import { SYSTEM_IMAGES, isSystemImageId } from "@shared/system-images";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

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

    const config = SYSTEM_IMAGES[id];
    try {
      const upstream = await fetch(config.url, {
        headers: SYSTEM_IMAGE_FETCH_HEADERS,
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok || !upstream.body) throw new Error("Upstream failed");
      const buffer = Buffer.from(await upstream.arrayBuffer());
      await fs.mkdir(SYSTEM_IMAGE_CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, buffer);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800");
      res.send(buffer);
    } catch (err) {
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

    // Try to fetch from Libretro assets
    const playlistName = LIBRETRO_PLAYLISTS[id];
    if (playlistName) {
      try {
        const logoUrl = `https://raw.githubusercontent.com/libretro/libretro-assets/master/xmb/monochrome/png/${encodeURIComponent(playlistName)}.png`;
        const response = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          await fs.mkdir(SYSTEM_LOGO_CACHE_DIR, { recursive: true });
          await fs.writeFile(cachePath, buffer);
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=604800");
          return res.send(buffer);
        }
      } catch (err) {
        console.error(`Failed to fetch logo for ${id}:`, err);
      }
    }

    res.status(404).json({ message: "Logo not found" });
  });
}
