import type { Express } from "express";
import type { Server } from 'node:http';
import { storage } from "./storage";
import { dataPath } from "./data-dir";
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import {
  insertGameCollectionSchema,
  insertRomSaveSlotSchema,
  insertUploadedRomSchema,
  integrationSettingsSchema,
} from "@shared/schema";
import {
  SYSTEM_IMAGES,
  isSystemImageId,
  type SystemImageId,
} from "@shared/system-images";
import { z } from "zod";

const ROM_EXTENSIONS: Record<string, string[]> = {
  nes: [".nes", ".zip", ".7z"],
  snes: [".sfc", ".smc", ".zip", ".7z"],
  n64: [".n64", ".z64", ".v64", ".zip", ".7z"],
  gba: [".gba", ".zip", ".7z"],
  genesis: [".gen", ".md", ".smd", ".bin", ".zip", ".7z"],
  ps1: [".cue", ".bin", ".iso", ".chd", ".pbp", ".zip", ".7z"],
  ps2: [".iso", ".chd", ".zip", ".7z"],
  arcade: [".zip", ".7z"],
  dreamcast: [".cdi", ".gdi", ".chd", ".zip", ".7z"],
};

// Configurable upload ceiling. PS1/PS2 disc images frequently exceed the old
// 512MB default — readers can dial this lower (or higher) per deployment via
// CABINET_MAX_UPLOAD_MB. The HA add-on wires this up from the `max_upload_mb`
// option in run.sh.
const MAX_UPLOAD_MB = (() => {
  const raw = Number.parseInt(process.env.CABINET_MAX_UPLOAD_MB ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 2048; // 2 GB default — covers virtually all PS1/PS2 ROM dumps.
})();
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const EMULATORJS_CORES: Record<string, string> = {
  nes: "nes",
  snes: "snes",
  n64: "n64",
  gba: "gba",
  genesis: "segaMD",
  ps1: "psx",
  ps2: "pcsx2",
  arcade: "mame2003",
};

const ROM_ROOT = path.resolve(dataPath("rom-storage"));
const SYSTEM_IMAGE_CACHE_DIR = path.resolve(dataPath("system-image-cache"));
const SYSTEM_IMAGE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "CabinetBridge/0.2 (+https://github.com/anthropics/claude-code; mailto:noreply@anthropic.com) Mozilla/5.0",
  Referer: "https://commons.wikimedia.org/",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};
const LIBRETRO_PLAYLISTS: Record<string, string> = {
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  n64: "Nintendo - Nintendo 64",
  gba: "Nintendo - Game Boy Advance",
  genesis: "Sega - Mega Drive - Genesis",
  ps1: "Sony - PlayStation",
  ps2: "Sony - PlayStation 2",
  dreamcast: "Sega - Dreamcast",
};

/**
 * Minimal ZIP extractor using Node built-in zlib.
 * Returns { buffer, fileName } for the first entry whose extension is in
 * allowedExtensions, or null when no matching entry is found.
 */
async function extractFirstRomFromZip(
  zipBuffer: Buffer,
  allowedExtensions: string[],
): Promise<{ buffer: Buffer; fileName: string } | null> {
  let offset = 0;
  while (offset + 30 < zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize    = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength    = zipBuffer.readUInt16LE(offset + 26);
    const extraLength       = zipBuffer.readUInt16LE(offset + 28);
    const fileName          = zipBuffer.slice(offset + 30, offset + 30 + fileNameLength).toString("utf8");
    const dataStart         = offset + 30 + fileNameLength + extraLength;
    const dataEnd           = dataStart + compressedSize;

    const ext = path.extname(fileName).toLowerCase();
    if (allowedExtensions.includes(ext) && !fileName.startsWith("__MACOSX")) {
      const compressed = zipBuffer.slice(dataStart, dataEnd);
      try {
        const buffer =
          compressionMethod === 0
            ? compressed
            : await new Promise<Buffer>((resolve, reject) => {
                zlib.inflateRaw(compressed, (err, result) => {
                  err ? reject(err) : resolve(result);
                });
              });
        return { buffer, fileName: path.basename(fileName) };
      } catch {
        // corrupt entry — try next
      }
    }
    offset = dataEnd;
  }
  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/settings/integration", async (_req, res) => {
    const settings = await storage.getIntegrationSettings();
    res.json(settings);
  });

  const writeIntegrationSettings = async (req: any, res: any) => {
    const parsed = integrationSettingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const saved = await storage.saveIntegrationSettings(parsed.data);
    res.json(saved);
  };

  app.put("/api/settings/integration", writeIntegrationSettings);
  app.patch("/api/settings/integration", writeIntegrationSettings);

  app.get("/api/upload-limits", (_req, res) => {
    res.json({
      maxUploadMb: MAX_UPLOAD_MB,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      allowedExtensions: ROM_EXTENSIONS,
    });
  });

  app.get("/api/roms", async (_req, res) => {
    const roms = await storage.listUploadedRoms();
    res.json(roms);
  });

  app.get("/api/roms/:id", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }
    res.json(rom);
  });

  app.get("/api/roms/:id/file", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }

    const safeRoot = `${ROM_ROOT}${path.sep}`;
    const resolved = path.resolve(rom.filePath);
    if (!resolved.startsWith(safeRoot)) {
      return res.status(403).json({ message: "ROM path is outside the storage directory." });
    }

    res.setHeader("Content-Type", rom.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${rom.originalName.replace(/"/g, "")}"`);
    res.sendFile(resolved);
  });

  // Returns all discs in the same disc group as this ROM, ordered by disc number.
  app.get("/api/roms/:id/discs", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }
    if (!rom.discGroup) {
      return res.json([rom]);
    }
    const discs = await storage.listRomsByDiscGroup(rom.discGroup);
    res.json(discs.length > 0 ? discs : [rom]);
  });

  app.get("/api/roms/:id/player", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      return res.status(404).send(renderPlayerError("Uploaded ROM not found."));
    }

    const core = EMULATORJS_CORES[rom.system];
    if (!core) {
      return res
        .status(400)
        .send(renderPlayerError(`${rom.system.toUpperCase()} is not configured for browser play yet.`));
    }

    await storage.markUploadedRomPlayed(id);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const returnTo = typeof req.query.return === "string" ? req.query.return : "";
    res.send(renderEmulatorPage({ title: rom.title, returnTo }));
  });

  app.get("/api/roms/:id/bootstrap.js", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.status(404).send(`document.body.textContent = "Uploaded ROM not found.";`);
    }

    const core = EMULATORJS_CORES[rom.system];
    if (!core) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res
        .status(400)
        .send(`document.body.textContent = ${JSON.stringify(`${rom.system.toUpperCase()} is not configured for browser play yet.`)};`);
    }

    // For multi-disc games, collect all siblings so we can pass EJS_discs
    let discs: Array<{ id: number; label: string }> = [];
    if (rom.discGroup) {
      const siblings = await storage.listRomsByDiscGroup(rom.discGroup);
      if (siblings.length > 1) {
        discs = siblings.map((s) => ({
          id: s.id,
          label: s.discNumber ? `Disc ${s.discNumber}` : s.title,
        }));
      }
    }

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(renderEmulatorBootstrap({
      core,
      title: rom.title,
      gameId: `${rom.system}-${rom.slug}`,
      romId: rom.id,
      discs,
    }));
  });

  app.patch("/api/roms/:id/rating", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ rating: z.number().int().min(0).max(5) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Rating must be a whole number from 0 to 5." });
    }

    const updated = await storage.updateUploadedRomRating(id, parsed.data.rating);
    if (!updated) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }
    res.json(updated);
  });

  app.patch("/api/roms/:id/favorite", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ favorite: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Favorite must be true or false." });
    }

    const updated = await storage.updateUploadedRomFavorite(id, parsed.data.favorite);
    if (!updated) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }
    res.json(updated);
  });

  app.delete("/api/roms/:id", async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteUploadedRom(id);
    if (!deleted) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }

    const safeRoot = `${ROM_ROOT}${path.sep}`;
    const resolved = path.resolve(deleted.filePath);
    let fileRemoved = false;
    if (resolved.startsWith(safeRoot)) {
      try {
        await fs.unlink(resolved);
        fileRemoved = true;
      } catch {
        fileRemoved = false;
      }
    }

    res.json({ deleted: true, id: deleted.id, fileRemoved });
  });

  app.get("/api/collections", async (_req, res) => {
    const collections = await storage.listCollections();
    res.json(collections);
  });

  app.post("/api/collections", express.json(), async (req, res) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(48) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Collection name must be 1-48 characters." });
    }

    const baseSlug = slugify(parsed.data.name);
    const collection = insertGameCollectionSchema.parse({
      name: parsed.data.name,
      slug: `${baseSlug}_${Date.now().toString(36)}`,
      createdAt: Date.now(),
    });
    const saved = await storage.createCollection(collection);
    res.status(201).json({ ...saved, romIds: [] });
  });

  app.delete("/api/collections/:id", async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteCollection(id);
    if (!deleted) {
      return res.status(404).json({ message: "Collection not found." });
    }
    res.status(204).end();
  });

  app.put("/api/collections/:id/roms/:romId", async (req, res) => {
    const id = Number(req.params.id);
    const romId = Number(req.params.romId);
    const updated = await storage.addRomToCollection(id, romId);
    if (!updated) {
      return res.status(404).json({ message: "Collection or ROM not found." });
    }
    res.json(updated);
  });

  app.delete("/api/collections/:id/roms/:romId", async (req, res) => {
    const id = Number(req.params.id);
    const romId = Number(req.params.romId);
    const updated = await storage.removeRomFromCollection(id, romId);
    if (!updated) {
      return res.status(404).json({ message: "Collection not found." });
    }
    res.json(updated);
  });

  app.get("/api/roms/:id/save-states", async (req, res) => {
    const romId = Number(req.params.id);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }

    const slots = await storage.listRomSaveSlots(romId);
    res.json(slots);
  });

  app.put("/api/roms/:id/save-states/:slot", express.json(), async (req, res) => {
    const romId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }

    const parsed = z
      .object({ label: z.string().trim().min(1).max(48).optional() })
      .safeParse(req.body ?? {});
    if (!Number.isInteger(slot) || slot < 1 || slot > 9 || !parsed.success) {
      return res.status(400).json({ message: "Save slot must be 1-9." });
    }

    const updatedAt = Date.now();
    const saveSlot = insertRomSaveSlotSchema.parse({
      romId,
      slot,
      label: parsed.data.label || `Slot ${slot}`,
      updatedAt,
    });
    const saved = await storage.upsertRomSaveSlot(saveSlot);
    res.json(saved);
  });

  app.delete("/api/roms/:id/save-states/:slot", async (req, res) => {
    const romId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      return res.status(400).json({ message: "Save slot must be 1-9." });
    }

    await storage.deleteRomSaveSlot(romId, slot);
    res.status(204).end();
  });

  app.post(
    "/api/roms/upload",
    express.raw({ type: "*/*", limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      const system = String(req.query.system ?? "");
      const favorite = req.query.favorite !== "0";
      const allowedExtensions = ROM_EXTENSIONS[system];

      if (!allowedExtensions) {
        return res.status(400).json({ message: "Choose a supported console before uploading." });
      }

      let body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (body.length === 0) {
        return res.status(400).json({ message: "Upload a ROM file before submitting." });
      }

      let originalName = decodeURIComponent(
        String(req.header("x-rom-filename") ?? "uploaded.rom"),
      );

      // Auto-extract ZIPs — find the first matching ROM inside
      const rawExt = path.extname(originalName).toLowerCase();
      if (rawExt === ".zip" && body.readUInt32LE(0) === 0x04034b50) {
        const extracted = await extractFirstRomFromZip(body, allowedExtensions);
        if (!extracted) {
          return res.status(400).json({
            message: `The ZIP archive doesn't contain any supported ${system.toUpperCase()} ROM file. Allowed extensions: ${allowedExtensions.join(", ")}`,
          });
        }
        body = extracted.buffer;
        originalName = extracted.fileName;
      }

      const extension = path.extname(originalName).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        return res.status(400).json({
          message: `.${extension.replace(".", "") || "rom"} files are not configured for ${system.toUpperCase()}. Allowed: ${allowedExtensions.join(", ")}`,
        });
      }

      const rawTitle = titleFromFileName(originalName);

      // Detect multi-disc indicators like "(Disc 1)", "[Disk 2]", "CD 3", etc.
      const discMatch = rawTitle.match(
        /\s*[\(\[](?:disc|disk|cd)\s*(\d+)[\)\]]|\s+(?:disc|disk|cd)\s*(\d+)/i,
      );
      const discNumber = discMatch ? parseInt(discMatch[1] ?? discMatch[2], 10) : null;
      // Strip the disc tag from the display title
      const title = discMatch ? rawTitle.replace(discMatch[0], "").trim() : rawTitle;
      // disc_group is "system/base-title-slug" so all discs share the same key
      const discGroup = discMatch ? `${system}/${slugify(title)}` : null;

      const baseSlug = slugify(rawTitle);
      const uniqueSuffix = Date.now().toString(36);
      const slug = `${system}_${baseSlug}_${uniqueSuffix}`;
      const safeName = `${slug}${extension}`;
      const systemDir = path.join(ROM_ROOT, system);
      const filePath = path.join(systemDir, safeName);

      await fs.mkdir(systemDir, { recursive: true });
      await fs.writeFile(filePath, body);

      // Try ScreenScraper first (rich metadata + art), fall back to Libretro art only
      const settings = await storage.getIntegrationSettings();
      const ssMeta = await fetchScreenScraperMeta(system, safeName, title, settings.ssUserId, settings.ssPassword);
      const libretroArt = ssMeta?.artUrl ? null : await findLibretroBoxArt(system, title);

      const rom = insertUploadedRomSchema.parse({
        title,
        system,
        slug,
        originalName,
        fileName: safeName,
        filePath,
        size: body.length,
        mimeType: req.header("content-type") ?? "application/octet-stream",
        artUrl: ssMeta?.artUrl ?? libretroArt?.url ?? null,
        scrapeStatus: ssMeta?.scrapeStatus ?? (libretroArt?.url ? "matched" : "not_found"),
        scrapeMessage: ssMeta?.scrapeMessage ?? libretroArt?.message ?? "",
        description: ssMeta?.description ?? null,
        releaseYear: ssMeta?.releaseYear ?? null,
        developer: ssMeta?.developer ?? null,
        publisher: ssMeta?.publisher ?? null,
        genre: ssMeta?.genre ?? null,
        players: ssMeta?.players ?? null,
        favorite,
        rating: 0,
        lastPlayed: 0,
        playCount: 0,
        discNumber,
        discGroup,
        createdAt: Date.now(),
      });

      const saved = await storage.createUploadedRom(rom);
      res.status(201).json(saved);
    },
  );

  app.get("/api/system-images", (_req, res) => {
    const list = Object.values(SYSTEM_IMAGES).map((entry) => ({
      id: entry.id,
      url: `/api/system-images/${entry.id}`,
      source: entry.source,
      sourceUrl: entry.sourceUrl,
      license: entry.license,
      upstreamUrl: entry.url,
    }));
    res.json(list);
  });

  app.get("/api/system-images/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!isSystemImageId(id)) {
      return res.status(404).json({ message: "Unknown system image id." });
    }
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    try {
      const file = await getCachedSystemImage(id, { forceRefresh: refresh });
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.sendFile(file);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch image.";
      res.status(404).json({ message });
    }
  });

  app.post("/api/system-images/:id/refresh", async (req, res) => {
    const id = String(req.params.id);
    if (!isSystemImageId(id)) {
      return res.status(404).json({ message: "Unknown system image id." });
    }
    try {
      const file = await getCachedSystemImage(id, { forceRefresh: true });
      const stat = await fs.stat(file);
      res.json({ id, refreshed: true, bytes: stat.size });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh image.";
      res.status(502).json({ id, refreshed: false, message });
    }
  });

  app.post("/api/roms/:id/scrape-art", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      return res.status(404).json({ message: "Uploaded ROM not found." });
    }

    const settings = await storage.getIntegrationSettings();
    const ssMeta = await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.ssUserId, settings.ssPassword);
    const libretroArt = ssMeta?.artUrl ? null : await findLibretroBoxArt(rom.system, rom.title);

    const updated = await storage.updateUploadedRomMetadata(id, {
      artUrl: ssMeta?.artUrl ?? libretroArt?.url ?? null,
      scrapeStatus: ssMeta?.scrapeStatus ?? (libretroArt?.url ? "matched" : "not_found"),
      scrapeMessage: ssMeta?.scrapeMessage ?? libretroArt?.message ?? "",
      description: ssMeta?.description ?? undefined,
      releaseYear: ssMeta?.releaseYear ?? undefined,
      developer: ssMeta?.developer ?? undefined,
      publisher: ssMeta?.publisher ?? undefined,
      genre: ssMeta?.genre ?? undefined,
      players: ssMeta?.players ?? undefined,
    });
    res.json(updated);
  });

  // Kiosk mode config — public so the client can read it before auth
  app.get("/api/kiosk", async (_req, res) => {
    const settings = await storage.getIntegrationSettings();
    res.json({
      enabled: settings.kioskMode,
      collectionId: settings.kioskCollectionId,
      hasPin: !!settings.kioskPin,
    });
  });

  app.post("/api/kiosk/verify-pin", express.json(), async (req, res) => {
    const { pin } = z.object({ pin: z.string() }).parse(req.body);
    const settings = await storage.getIntegrationSettings();
    res.json({ valid: !settings.kioskPin || pin === settings.kioskPin });
  });

  // Fire a Home Assistant event when a game starts/ends in the browser player
  app.post("/api/roms/:id/play-session", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const { event, durationSeconds } = z.object({
      event: z.enum(["started", "ended"]),
      durationSeconds: z.number().int().min(0).optional(),
    }).parse(req.body);

    const settings = await storage.getIntegrationSettings();
    if (settings.haBaseUrl && settings.haToken) {
      const eventType = event === "started" ? "cabinet_bridge_game_started" : "cabinet_bridge_game_ended";
      const payload = {
        game: rom.title,
        system: rom.system,
        rom_id: rom.id,
        ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
      };
      try {
        await fetch(`${settings.haBaseUrl}/api/events/${eventType}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.haToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        // HA event failure is non-fatal
      }
    }

    res.json({ ok: true });
  });

  return httpServer;
}

async function getCachedSystemImage(
  id: SystemImageId,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<string> {
  await fs.mkdir(SYSTEM_IMAGE_CACHE_DIR, { recursive: true });
  const cachePath = path.join(SYSTEM_IMAGE_CACHE_DIR, `${id}.jpg`);
  if (!forceRefresh) {
    try {
      const stat = await fs.stat(cachePath);
      if (stat.size > 0) return cachePath;
    } catch {
      // miss — fall through to fetch
    }
  }

  const upstream = SYSTEM_IMAGES[id].url;
  let lastError: unknown = null;
  try {
    const response = await fetch(upstream, { headers: SYSTEM_IMAGE_FETCH_HEADERS });
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 0) {
        await fs.writeFile(cachePath, buffer);
        return cachePath;
      }
      lastError = new Error("Empty image body from upstream.");
    } else {
      lastError = new Error(`Upstream returned ${response.status}.`);
    }
  } catch (error) {
    lastError = error;
  }

  // If a stale cached copy exists, prefer serving it over failing.
  try {
    const stat = await fs.stat(cachePath);
    if (stat.size > 0) return cachePath;
  } catch {
    // no stale cache
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("System image fetch failed.");
}

// ScreenScraper system IDs: https://www.screenscraper.fr/api2/systemesListe.php
const SCREENSCRAPER_SYSTEM_IDS: Record<string, number> = {
  nes: 3,
  snes: 4,
  n64: 14,
  gba: 12,
  genesis: 1,
  ps1: 57,
  ps2: 58,
  arcade: 75,
};

interface ScreenScraperMeta {
  artUrl: string | null;
  description: string | null;
  releaseYear: number | null;
  developer: string | null;
  publisher: string | null;
  genre: string | null;
  players: string | null;
  scrapeStatus: string;
  scrapeMessage: string;
}

async function fetchScreenScraperMeta(
  system: string,
  romFileName: string,
  title: string,
  ssUserId: string,
  ssPassword: string,
): Promise<ScreenScraperMeta | null> {
  const systemId = SCREENSCRAPER_SYSTEM_IDS[system];
  if (!systemId) return null;

  const params = new URLSearchParams({
    devid: "cabinet_bridge",
    devpassword: "cabinet_bridge",
    softname: "cabinet_bridge",
    output: "json",
    systemeid: String(systemId),
    romtype: "rom",
    romfilename: romFileName,
  });
  if (ssUserId) params.set("ssid", ssUserId);
  if (ssPassword) params.set("sspassword", ssPassword);

  try {
    const res = await fetch(`https://www.screenscraper.fr/api2/jeuInfos.php?${params}`, {
      headers: { "User-Agent": "CabinetBridge/0.1" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json() as Record<string, unknown>;
    const jeu = (json?.response as Record<string, unknown>)?.jeu as Record<string, unknown> | undefined;
    if (!jeu) return null;

    // Description: prefer English, fall back to first available
    let description: string | null = null;
    const synopses = jeu.synopsis as Array<{ langue: string; text: string }> | undefined;
    if (Array.isArray(synopses)) {
      const en = synopses.find((s) => s.langue === "en");
      description = (en ?? synopses[0])?.text ?? null;
    }

    // Release year: prefer world/us region
    let releaseYear: number | null = null;
    const dates = jeu.dates as Array<{ region: string; text: string }> | undefined;
    if (Array.isArray(dates)) {
      const preferred = dates.find((d) => ["wor", "us", "eu"].includes(d.region)) ?? dates[0];
      const y = preferred?.text ? parseInt(preferred.text.slice(0, 4), 10) : NaN;
      if (!isNaN(y)) releaseYear = y;
    }

    const developer = (jeu.developpeur as { text?: string })?.text ?? null;
    const publisher = (jeu.editeur as { text?: string })?.text ?? null;

    let genre: string | null = null;
    const genres = jeu.genres as Array<{ noms: Array<{ langue: string; text: string }> }> | undefined;
    if (Array.isArray(genres) && genres.length > 0) {
      const names = genres.map((g) => {
        const en = (g.noms ?? []).find((n) => n.langue === "en");
        return (en ?? g.noms?.[0])?.text;
      }).filter(Boolean) as string[];
      genre = names.slice(0, 2).join(", ") || null;
    }

    const players = (jeu.joueurs as { text?: string })?.text ?? null;

    // Box art: prefer "box-2D" media in us/wor region
    let artUrl: string | null = null;
    const medias = jeu.medias as Array<{ type: string; region?: string; url?: string }> | undefined;
    if (Array.isArray(medias)) {
      const boxTypes = ["box-2D", "box-2D-side", "mixrbv1"];
      for (const boxType of boxTypes) {
        const candidates = medias.filter((m) => m.type === boxType);
        const best = candidates.find((m) => ["us", "wor", "eu"].includes(m.region ?? "")) ?? candidates[0];
        if (best?.url) { artUrl = best.url; break; }
      }
    }

    return {
      artUrl,
      description,
      releaseYear,
      developer,
      publisher,
      genre,
      players,
      scrapeStatus: "matched",
      scrapeMessage: "Metadata from ScreenScraper.fr",
    };
  } catch {
    return null;
  }
}

async function findLibretroBoxArt(system: string, title: string) {
  const playlist = LIBRETRO_PLAYLISTS[system];
  if (!playlist) {
    return {
      url: null,
      message: "No Libretro thumbnail playlist is configured for this system.",
    };
  }

  const directoryUrl = `https://thumbnails.libretro.com/${encodeURIComponent(playlist)}/Named_Boxarts/`;
  try {
    const response = await fetch(directoryUrl, {
      headers: { "User-Agent": "CabinetBridge/0.1" },
    });
    if (!response.ok) {
      return { url: null, message: `Thumbnail directory returned ${response.status}.` };
    }
    const html = await response.text();
    const hrefs = Array.from(html.matchAll(/href="([^"]+\.png)"/gi)).map((m) =>
      decodeHtml(m[1]),
    );
    const normalizedTitle = normalizeSearchTitle(title);
    const targetTokens = significantTokens(normalizedTitle);
    const candidates = hrefs
      .map((href) => {
        const decoded = decodeURIComponent(href);
        const fileTitle = decoded.replace(/\.png$/i, "");
        const baseTitle = fileTitle.replace(/\s*\(.+$/, "");
        const normalizedFile = normalizeTitle(fileTitle);
        const normalizedBase = normalizeSearchTitle(baseTitle);
        const candidateTokens = significantTokens(normalizedBase);
        const targetNumbers = numberTokens(targetTokens);
        const candidateNumbers = numberTokens(candidateTokens);
        const numberMismatch =
          targetNumbers.length > 0 &&
          candidateNumbers.length > 0 &&
          !targetNumbers.some((token) => candidateNumbers.includes(token));
        const overlap = targetTokens.filter((token) => candidateTokens.includes(token));
        const textScore =
          numberMismatch
            ? 0
            : 
          normalizedBase === normalizedTitle
            ? 100
            : normalizedFile.startsWith(normalizedTitle)
            ? 82
            : overlap.length >= Math.min(2, targetTokens.length)
            ? (overlap.length / Math.max(1, targetTokens.length)) * 65 +
              (overlap.length / Math.max(1, candidateTokens.length)) * 25
            : 0;
        let score = 0;
        if (textScore > 0) {
          score += textScore;
          if (/\(USA\)|\(US\)/i.test(decoded)) score += 20;
          if (/\(World\)/i.test(decoded)) score += 12;
          if (/\(Europe\)/i.test(decoded)) score += 8;
          if (/\[h|\[b|\[tr|\[p|prototype|sample/i.test(decoded)) score -= 40;
          if (normalizedBase !== normalizedTitle && normalizedBase.startsWith(normalizedTitle)) score -= 20;
        }
        return { href, decoded, score };
      })
      .filter((candidate) => candidate.score >= 55)
      .sort((a, b) => b.score - a.score || a.decoded.length - b.decoded.length);

    const best = candidates[0];
    if (!best) {
      return { url: null, message: `No Libretro box art match found for “${title}”.` };
    }

    return {
      url: `${directoryUrl}${best.href}`,
      message: `Matched Libretro Named_Boxarts: ${best.decoded}`,
    };
  } catch (error) {
    return {
      url: null,
      message: error instanceof Error ? error.message : "Artwork scrape failed.",
    };
  }
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSearchTitle(value: string) {
  return significantTokens(normalizeTitle(value)).join(" ");
}

function significantTokens(value: string) {
  const noise = new Set([
    "u",
    "usa",
    "us",
    "eng",
    "snes",
    "sfc",
    "smc",
    "rev",
    "version",
  ]);
  const roman: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
  };
  const rawTokens = value.split(/\s+/).filter(Boolean);
  return rawTokens
    .filter((token, index, tokens) => {
      if (noise.has(token)) return false;
      if (token === "v" && /^\d+$/.test(tokens[index + 1] ?? "")) return false;
      if (/^\d+$/.test(token) && tokens[index - 1] === "v") return false;
      return true;
    })
    .map((token) => roman[token] ?? token);
}

function numberTokens(tokens: string[]) {
  return tokens.filter((token) => /^\d+$/.test(token));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleFromFileName(fileName: string) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "rom"
  );
}

function renderEmulatorPage({ title, returnTo }: { title: string; returnTo: string }) {
  const safeTitle = escapeHtml(title);
  const safeReturnTo = JSON.stringify(returnTo);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} · Cabinet Bridge</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #050507;
        color: #f8fafc;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      .cabinet-menu-button {
        position: fixed;
        z-index: 999999;
        top: max(12px, env(safe-area-inset-top));
        left: max(12px, env(safe-area-inset-left));
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background: rgba(5, 5, 7, 0.58);
        color: #f8fafc;
        cursor: pointer;
        font: 800 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.14em;
        min-height: 46px;
        padding: 0 18px;
        text-transform: uppercase;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(12px);
        transition: opacity 180ms ease, transform 180ms ease, background 180ms ease, border-color 180ms ease;
      }
      .cabinet-menu-button:hover,
      .cabinet-menu-button:focus-visible,
      .cabinet-menu-button[aria-expanded="true"] {
        background: rgba(236, 72, 153, 0.36);
        border-color: rgba(236, 72, 153, 0.78);
        outline: none;
      }
      .cabinet-menu-button:active {
        transform: translateY(1px) scale(0.98);
      }
      .cabinet-menu-backdrop {
        position: fixed;
        z-index: 999998;
        inset: 0;
        background: rgba(5, 5, 7, 0.54);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, visibility 180ms ease;
        visibility: hidden;
      }
      .cabinet-menu-panel {
        position: fixed;
        z-index: 999999;
        top: max(70px, calc(env(safe-area-inset-top) + 64px));
        left: max(12px, env(safe-area-inset-left));
        width: min(92vw, 360px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        background: rgba(11, 11, 16, 0.84);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.58);
        color: #f8fafc;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-8px) scale(0.98);
        transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
        visibility: hidden;
        backdrop-filter: blur(18px);
      }
      .cabinet-menu-panel.is-open,
      .cabinet-menu-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
        visibility: visible;
      }
      .cabinet-menu-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 18px 12px;
      }
      .cabinet-menu-title {
        margin: 0;
        color: #f8fafc;
        font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-menu-subtitle {
        margin: 5px 0 0;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
      }
      .cabinet-menu-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 8px 18px 18px;
      }
      .cabinet-menu-panel button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.12em;
        min-height: 54px;
        padding: 10px 12px;
        text-transform: uppercase;
      }
      .cabinet-menu-panel button:hover,
      .cabinet-menu-panel button:focus-visible,
      .cabinet-menu-panel button[aria-pressed="true"] {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-menu-panel .primary-action {
        grid-column: 1 / -1;
        background: rgba(236, 72, 153, 0.42);
        border-color: rgba(236, 72, 153, 0.78);
      }
      .cabinet-menu-panel .danger {
        grid-column: 1 / -1;
      }
      .cabinet-menu-panel .danger:hover,
      .cabinet-menu-panel .danger:focus-visible {
        background: rgba(239, 68, 68, 0.32);
        border-color: rgba(239, 68, 68, 0.72);
      }
      .cabinet-save-panel {
        position: fixed;
        z-index: 1000000;
        left: 50%;
        top: 50%;
        width: min(94vw, 760px);
        max-height: min(86vh, 720px);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 24px;
        background: rgba(11, 11, 16, 0.9);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.66);
        color: #f8fafc;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -48%) scale(0.98);
        transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
        visibility: hidden;
        backdrop-filter: blur(20px);
      }
      .cabinet-save-panel.is-open {
        opacity: 1;
        pointer-events: auto;
        transform: translate(-50%, -50%) scale(1);
        visibility: visible;
      }
      .cabinet-save-panel__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 18px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .cabinet-save-title {
        margin: 0;
        color: #f8fafc;
        font: 900 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-save-subtitle {
        margin: 6px 0 0;
        color: rgba(248, 250, 252, 0.6);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
      }
      .cabinet-save-close {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 900 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        min-height: 40px;
        min-width: 40px;
      }
      .cabinet-save-close:hover,
      .cabinet-save-close:focus-visible {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-save-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        max-height: calc(min(86vh, 720px) - 94px);
        overflow-y: auto;
        padding: 14px 18px 18px;
      }
      .cabinet-save-slot {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.06);
        padding: 12px;
      }
      .cabinet-save-slot[data-filled="true"] {
        border-color: rgba(236, 72, 153, 0.46);
        background:
          radial-gradient(circle at 12% 0%, rgba(236, 72, 153, 0.2), transparent 44%),
          rgba(255, 255, 255, 0.07);
      }
      .cabinet-save-slot__thumb {
        width: 100%;
        aspect-ratio: 4/3;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(0,0,0,0.35);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cabinet-save-slot__thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        image-rendering: pixelated;
      }
      .cabinet-save-slot__thumb--empty::after {
        content: "NO SAVE";
        color: rgba(248,250,252,0.2);
        font: 800 8px ui-monospace, monospace;
        letter-spacing: 0.2em;
      }
      .cabinet-save-slot__eyebrow {
        color: rgba(248, 250, 252, 0.56);
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-save-slot__label {
        margin-top: 5px;
        color: #f8fafc;
        font: 900 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      .cabinet-save-slot__meta {
        min-height: 32px;
        margin-top: 5px;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        line-height: 1.5;
      }
      .cabinet-save-slot__actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 10px;
      }
      .cabinet-save-slot button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
      }
      .cabinet-save-slot button:hover,
      .cabinet-save-slot button:focus-visible {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-save-slot button:disabled {
        cursor: not-allowed;
        opacity: 0.38;
      }
      .cabinet-save-slot .danger:hover,
      .cabinet-save-slot .danger:focus-visible {
        background: rgba(239, 68, 68, 0.28);
        border-color: rgba(239, 68, 68, 0.68);
      }
      .cabinet-aspect-btn {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 12px;
        background: rgba(255,255,255,0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 800 9px ui-monospace,monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
      }
      .cabinet-aspect-btn:hover,
      .cabinet-aspect-btn:focus-visible,
      .cabinet-aspect-btn[aria-checked="true"] {
        background: rgba(236,72,153,0.34);
        border-color: rgba(236,72,153,0.75);
        outline: none;
      }
      #game canvas {
        transition: filter 0.2s;
      }
      #game.cabinet-filter-crt canvas {
        filter: contrast(1.1) brightness(0.95) saturate(1.1);
      }
      #game.cabinet-filter-crt canvas::after {
        content: "";
      }
      #game.cabinet-filter-smooth canvas {
        image-rendering: auto;
        filter: blur(0.4px) brightness(1.02);
      }
      .cabinet-toast {
        position: fixed;
        z-index: 1000000;
        top: max(70px, calc(env(safe-area-inset-top) + 64px));
        left: 50%;
        transform: translateX(-50%);
        max-width: min(90vw, 520px);
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(236, 72, 153, 0.92);
        color: white;
        font: 700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }
      .cabinet-toast.show {
        opacity: 1;
      }
      #game {
        width: 100vw;
        height: 100vh;
      }
      #game canvas,
      #game iframe,
      #game video {
        max-width: 100vw !important;
      }
      .ejs_virtualGamepad_parent,
      .ejs_virtualGamepad_open,
      .ejs_menu_bar,
      .ejs_context_menu {
        display: none !important;
        pointer-events: none !important;
      }
      .cabinet-launch-overlay {
        position: fixed;
        z-index: 999998;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at 50% 32%, rgba(236, 72, 153, 0.22), transparent 34%),
          linear-gradient(180deg, rgba(5, 5, 7, 0.92), rgba(5, 5, 7, 0.72));
        color: #f8fafc;
        opacity: 1;
        pointer-events: none;
        transition: opacity 240ms ease, visibility 240ms ease;
        visibility: visible;
      }
      .cabinet-launch-overlay.is-hidden {
        opacity: 0;
        visibility: hidden;
      }
      .cabinet-launch-card {
        width: min(88vw, 520px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        background: rgba(11, 11, 16, 0.78);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.52);
        padding: 22px;
        text-align: left;
        backdrop-filter: blur(18px);
      }
      .cabinet-launch-title {
        margin: 0 0 8px;
        color: #f8fafc;
        font: 800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .cabinet-launch-status {
        margin: 0 0 16px;
        color: rgba(248, 250, 252, 0.72);
        font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.6;
      }
      .cabinet-progress-track {
        width: 100%;
        height: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
      }
      .cabinet-progress-bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ec4899, #f9a8d4);
        box-shadow: 0 0 22px rgba(236, 72, 153, 0.45);
        transition: width 260ms ease;
      }
      .cabinet-progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 10px;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .loading {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        background:
          radial-gradient(circle at 50% 30%, rgba(168, 85, 247, 0.24), transparent 45%),
          #050507;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 12px;
        text-align: center;
      }
      .hint {
        max-width: 520px;
        color: rgba(248, 250, 252, 0.7);
        letter-spacing: 0.08em;
        line-height: 1.7;
        text-transform: none;
        font-size: 11px;
      }
      .virtual-pad {
        position: fixed;
        z-index: 999997;
        inset: 76px 0 0;
        pointer-events: none;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .virtual-pad.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .virtual-pad[hidden] {
        display: none;
      }
      .virtual-pad__tray {
        display: none;
      }
      .virtual-pad__hide {
        display: none;
      }
      .virtual-pad button {
        appearance: none;
        min-width: 54px;
        min-height: 54px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.07)),
          rgba(5, 5, 7, 0.58);
        color: #f8fafc;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.16),
          0 10px 28px rgba(0, 0, 0, 0.38);
        cursor: pointer;
        font: 800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        pointer-events: auto;
        text-transform: uppercase;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .virtual-pad button:focus-visible {
        border-color: rgba(236, 72, 153, 0.9);
        outline: 2px solid rgba(236, 72, 153, 0.42);
        outline-offset: 3px;
      }
      .virtual-pad button.is-pressed,
      .virtual-pad button:active {
        background:
          linear-gradient(180deg, rgba(236, 72, 153, 0.54), rgba(236, 72, 153, 0.26)),
          rgba(5, 5, 7, 0.66);
        border-color: rgba(236, 72, 153, 0.95);
        transform: translateY(2px) scale(0.97);
      }
      .virtual-pad__shoulders {
        position: absolute;
        top: 8px;
        left: max(18px, env(safe-area-inset-left));
        right: max(18px, env(safe-area-inset-right));
        display: flex;
        justify-content: space-between;
      }
      .virtual-pad__shoulders button {
        min-width: min(26vw, 128px);
        border-radius: 18px;
      }
      .virtual-pad__dpad {
        position: absolute;
        left: max(18px, env(safe-area-inset-left));
        bottom: max(24px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: repeat(3, 58px);
        grid-template-rows: repeat(3, 58px);
        gap: 6px;
        pointer-events: none;
      }
      .virtual-pad__dpad .up {
        grid-column: 2;
        grid-row: 1;
      }
      .virtual-pad__dpad .left {
        grid-column: 1;
        grid-row: 2;
      }
      .virtual-pad__dpad .right {
        grid-column: 3;
        grid-row: 2;
      }
      .virtual-pad__dpad .down {
        grid-column: 2;
        grid-row: 3;
      }
      .virtual-pad__dpad-core {
        grid-column: 2;
        grid-row: 2;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.1);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      }
      .virtual-pad__face {
        position: absolute;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(28px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: repeat(3, 58px);
        grid-template-rows: repeat(3, 58px);
        gap: 6px;
        pointer-events: none;
      }
      .virtual-pad__face .y {
        grid-column: 1;
        grid-row: 2;
      }
      .virtual-pad__face .x {
        grid-column: 2;
        grid-row: 1;
      }
      .virtual-pad__face .b {
        grid-column: 2;
        grid-row: 3;
      }
      .virtual-pad__face .a {
        grid-column: 3;
        grid-row: 2;
      }
      .virtual-pad__system {
        position: absolute;
        left: 50%;
        bottom: max(28px, env(safe-area-inset-bottom));
        display: flex;
        gap: 12px;
        transform: translateX(-50%);
      }
      .virtual-pad__system button {
        min-width: 86px;
        min-height: 44px;
        border-radius: 16px;
        font-size: 10px;
      }
      @media (max-width: 720px) {
        body.cabinet-pad-mobile.cabinet-pad-on #game {
          height: var(--cabinet-emu-height, min(54vh, 460px));
          min-height: 240px;
          overflow: hidden;
        }
        body.cabinet-pad-mobile.cabinet-pad-on #game canvas,
        body.cabinet-pad-mobile.cabinet-pad-on #game iframe,
        body.cabinet-pad-mobile.cabinet-pad-on #game video {
          max-height: var(--cabinet-emu-height, min(54vh, 460px)) !important;
        }
        .cabinet-menu-panel {
          left: 12px;
          right: 12px;
          top: max(72px, calc(env(safe-area-inset-top) + 66px));
          width: auto;
        }
        .cabinet-aspect-btn {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 12px;
        background: rgba(255,255,255,0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 800 9px ui-monospace,monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
      }
      .cabinet-aspect-btn:hover,
      .cabinet-aspect-btn:focus-visible,
      .cabinet-aspect-btn[aria-checked="true"] {
        background: rgba(236,72,153,0.34);
        border-color: rgba(236,72,153,0.75);
        outline: none;
      }
      #game canvas {
        transition: filter 0.2s;
      }
      #game.cabinet-filter-crt canvas {
        filter: contrast(1.1) brightness(0.95) saturate(1.1);
      }
      #game.cabinet-filter-crt canvas::after {
        content: "";
      }
      #game.cabinet-filter-smooth canvas {
        image-rendering: auto;
        filter: blur(0.4px) brightness(1.02);
      }
      .cabinet-toast {
          top: max(78px, calc(env(safe-area-inset-top) + 70px));
        }
        .cabinet-save-panel {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 34px);
        }
        .cabinet-save-grid {
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: calc(100dvh - 128px);
          padding: 10px 12px 14px;
        }
        .cabinet-save-panel__header {
          padding: 16px 16px 12px;
        }
        .cabinet-save-slot {
          padding: 10px;
          border-radius: 16px;
        }
        .cabinet-save-slot__meta {
          min-height: 18px;
        }
        .cabinet-save-slot__actions {
          margin-top: 8px;
        }
        .cabinet-save-slot button {
          min-height: 34px;
        }
        body.cabinet-pad-mobile .virtual-pad {
          inset: auto 0 0 0;
          height: var(--cabinet-tray-height, max(46vh, 360px));
          pointer-events: none;
        }
        body.cabinet-pad-mobile .virtual-pad__tray {
          position: absolute;
          inset: 0;
          display: block;
          pointer-events: auto;
          background:
            radial-gradient(120% 80% at 50% -10%, rgba(236, 72, 153, 0.12), transparent 60%),
            linear-gradient(180deg, rgba(11, 11, 16, 0.92), rgba(5, 5, 7, 0.98));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.5);
        }
        body.cabinet-pad-mobile .virtual-pad__hide {
          position: absolute;
          z-index: 2;
          top: 6px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          appearance: none;
          min-width: 96px;
          min-height: 22px;
          padding: 4px 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          background: rgba(5, 5, 7, 0.7);
          color: rgba(248, 250, 252, 0.78);
          font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          pointer-events: auto;
          touch-action: manipulation;
        }
        body.cabinet-pad-mobile .virtual-pad__hide:hover,
        body.cabinet-pad-mobile .virtual-pad__hide:focus-visible {
          background: rgba(236, 72, 153, 0.34);
          border-color: rgba(236, 72, 153, 0.7);
          color: #f8fafc;
          outline: none;
        }
        .virtual-pad__shoulders {
          position: absolute;
          left: max(14px, env(safe-area-inset-left));
          right: max(14px, env(safe-area-inset-right));
          top: 38px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
        }
        .virtual-pad__shoulders button {
          min-width: min(22vw, 90px);
          min-height: 40px;
          border-radius: 14px;
          font-size: 11px;
          pointer-events: auto;
        }
        .virtual-pad__system {
          position: absolute;
          top: 38px;
          left: 50%;
          bottom: auto;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          pointer-events: none;
        }
        .virtual-pad__system button {
          min-width: 78px;
          min-height: 40px;
          border-radius: 14px;
          font-size: 10px;
          pointer-events: auto;
        }
        .virtual-pad__dpad,
        .virtual-pad__face {
          --cabinet-pad-cell: clamp(44px, calc((100vw - 68px) / 6), 60px);
          --cabinet-pad-gap: 6px;
          bottom: max(20px, env(safe-area-inset-bottom));
          grid-template-columns: repeat(3, var(--cabinet-pad-cell));
          grid-template-rows: repeat(3, var(--cabinet-pad-cell));
          gap: var(--cabinet-pad-gap);
          pointer-events: none;
          max-width: calc(50vw - 12px);
        }
        .virtual-pad__dpad {
          left: max(10px, env(safe-area-inset-left));
        }
        .virtual-pad__face {
          right: max(10px, env(safe-area-inset-right));
        }
        .virtual-pad button {
          min-width: 44px;
          min-height: 44px;
        }
        .virtual-pad__dpad button,
        .virtual-pad__face button {
          width: var(--cabinet-pad-cell);
          height: var(--cabinet-pad-cell);
        }
      }
      @media (max-width: 520px) {
        .virtual-pad__shoulders button,
        .virtual-pad__system button {
          min-height: 38px;
        }
        .virtual-pad__system button {
          min-width: 70px;
          font-size: 10px;
        }
      }
      @media (max-width: 360px) {
        .virtual-pad__system button {
          min-width: 62px;
        }
      }
    </style>
  </head>
  <body>
    <button type="button" class="cabinet-menu-button" id="cabinet-menu-toggle" aria-expanded="false" aria-controls="cabinet-menu-panel" data-testid="button-open-player-menu">Menu</button>
    <div class="cabinet-menu-backdrop" id="cabinet-menu-backdrop" aria-hidden="true"></div>
    <nav class="cabinet-menu-panel" id="cabinet-menu-panel" aria-label="Game system menu" aria-hidden="true">
      <div class="cabinet-menu-panel__header">
        <div>
          <p class="cabinet-menu-title">System Menu</p>
          <p class="cabinet-menu-subtitle">Save, load, controls, exit</p>
        </div>
      </div>
      <div class="cabinet-menu-grid">
        <button type="button" class="primary-action" id="cabinet-resume" data-testid="button-resume-game">Resume Game</button>
        <button type="button" id="cabinet-save" data-testid="button-quick-save">Quick Save</button>
        <button type="button" id="cabinet-load" data-testid="button-quick-load">Quick Load</button>
        <button type="button" id="cabinet-save-manager-open" data-testid="button-open-save-manager">Save Slots</button>
        <button type="button" id="cabinet-pad-toggle" aria-pressed="false" data-testid="button-toggle-gamepad">Gamepad</button>
        <button type="button" id="cabinet-controls" data-testid="button-show-controls">Controls</button>
        <button type="button" id="cabinet-rewind-toggle" aria-pressed="false" data-testid="button-toggle-rewind">Rewind</button>
        <button type="button" id="cabinet-ff-toggle" aria-pressed="false" data-testid="button-toggle-fastforward">Fast-Fwd</button>
        <button type="button" id="cabinet-cheats" data-testid="button-cheats">Cheats</button>
        <button type="button" id="cabinet-screenshot" data-testid="button-screenshot">Screenshot</button>
        <button type="button" id="cabinet-display-open" data-testid="button-display-settings">Display</button>
        <button type="button" id="cabinet-remap-open" data-testid="button-remap-controls">Remap Keys</button>
        <button type="button" class="danger" id="cabinet-exit" data-testid="button-exit-player">Exit Game</button>
      </div>
    </nav>
    <section class="cabinet-save-panel" id="cabinet-save-panel" aria-label="Save state manager" aria-hidden="true" data-testid="panel-save-manager">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Save-state Manager</p>
          <p class="cabinet-save-subtitle">Nine browser-local slots for this game</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-save-manager-close" aria-label="Close save-state manager" data-testid="button-close-save-manager">×</button>
      </div>
      <div class="cabinet-save-grid" id="cabinet-save-grid" data-testid="grid-save-slots"></div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-display-panel" aria-label="Display settings" aria-hidden="true" data-testid="panel-display-settings">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Display</p>
          <p class="cabinet-save-subtitle">Aspect ratio and visual filter</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-display-close" aria-label="Close display settings" data-testid="button-close-display">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:16px;">
        <div>
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">Aspect Ratio</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="cabinet-aspect-group" role="radiogroup" aria-label="Aspect ratio">
            <button type="button" role="radio" aria-checked="true" data-aspect="4:3" data-testid="button-aspect-4-3" class="cabinet-aspect-btn">4:3</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="16:9" data-testid="button-aspect-16-9" class="cabinet-aspect-btn">16:9</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="pixel" data-testid="button-aspect-pixel" class="cabinet-aspect-btn">Pixel</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="stretch" data-testid="button-aspect-stretch" class="cabinet-aspect-btn">Fill</button>
          </div>
        </div>
        <div>
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">Visual Filter</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;" id="cabinet-filter-group" role="radiogroup" aria-label="Visual filter">
            <button type="button" role="radio" aria-checked="true" data-filter="none" data-testid="button-filter-none" class="cabinet-aspect-btn">None</button>
            <button type="button" role="radio" aria-checked="false" data-filter="crt" data-testid="button-filter-crt" class="cabinet-aspect-btn">CRT</button>
            <button type="button" role="radio" aria-checked="false" data-filter="smooth" data-testid="button-filter-smooth" class="cabinet-aspect-btn">Smooth</button>
          </div>
        </div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-remap-panel" aria-label="Key remapping" aria-hidden="true" data-testid="panel-remap">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Remap Keys</p>
          <p class="cabinet-save-subtitle">Click a button, then press a key. Saved locally.</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-remap-close" aria-label="Close key remapping" data-testid="button-close-remap">×</button>
      </div>
      <div id="cabinet-remap-grid" style="padding:14px 18px 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;max-height:calc(min(86vh,720px)-94px);"></div>
      <div style="padding:0 18px 14px;display:flex;gap:8px;">
        <button type="button" id="cabinet-remap-reset" style="appearance:none;border:1px solid rgba(239,68,68,0.5);border-radius:12px;background:rgba(239,68,68,0.12);color:#f8fafc;cursor:pointer;font:800 9px ui-monospace,monospace;letter-spacing:0.12em;padding:10px 16px;text-transform:uppercase;">Reset to Defaults</button>
      </div>
    </section>
    <div class="cabinet-toast" id="cabinet-toast" role="status" aria-live="polite"></div>
    <div id="game">
      <div class="loading">
        <div>Loading ${safeTitle}</div>
        <div class="hint">If this message stays visible, the preview frame blocked the emulator loader. Use the standalone player button above, or run Cabinet Bridge locally in Home Assistant.</div>
      </div>
    </div>
    <div class="cabinet-launch-overlay" id="cabinet-launch-overlay" role="status" aria-live="polite" data-testid="overlay-launch-progress">
      <div class="cabinet-launch-card">
        <p class="cabinet-launch-title">Loading ${safeTitle}</p>
        <p class="cabinet-launch-status" id="cabinet-launch-status">Preparing the emulator…</p>
        <div class="cabinet-progress-track" aria-hidden="true">
          <div class="cabinet-progress-bar" id="cabinet-progress-bar"></div>
        </div>
        <div class="cabinet-progress-meta">
          <span id="cabinet-progress-stage">Boot sequence</span>
          <span id="cabinet-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div class="virtual-pad" id="cabinet-gamepad" aria-label="Virtual gamepad overlay" hidden data-testid="overlay-virtual-gamepad">
      <div class="virtual-pad__tray" aria-hidden="true"></div>
      <button type="button" class="virtual-pad__hide" id="cabinet-pad-hide" data-testid="button-gamepad-hide" aria-label="Hide virtual gamepad">Hide Pad</button>
      <div class="virtual-pad__shoulders" aria-label="Shoulder buttons">
        <button type="button" data-vkey="q" data-ejs-input="10" data-testid="button-gamepad-l1" aria-label="L1 shoulder">L1</button>
        <button type="button" data-vkey="w" data-ejs-input="11" data-testid="button-gamepad-r1" aria-label="R1 shoulder">R1</button>
      </div>
      <div class="virtual-pad__system" aria-label="System buttons">
        <button type="button" data-vkey="Shift" data-ejs-input="2" data-testid="button-gamepad-select" aria-label="Select">Select</button>
        <button type="button" data-vkey="Enter" data-ejs-input="3" data-testid="button-gamepad-start" aria-label="Start">Start</button>
      </div>
      <div class="virtual-pad__dpad" aria-label="Directional pad">
        <button type="button" class="up" data-vkey="ArrowUp" data-ejs-input="4" data-testid="button-gamepad-up" aria-label="D-pad up">↑</button>
        <button type="button" class="left" data-vkey="ArrowLeft" data-ejs-input="6" data-testid="button-gamepad-left" aria-label="D-pad left">←</button>
        <span class="virtual-pad__dpad-core" aria-hidden="true"></span>
        <button type="button" class="right" data-vkey="ArrowRight" data-ejs-input="7" data-testid="button-gamepad-right" aria-label="D-pad right">→</button>
        <button type="button" class="down" data-vkey="ArrowDown" data-ejs-input="5" data-testid="button-gamepad-down" aria-label="D-pad down">↓</button>
      </div>
      <div class="virtual-pad__face" aria-label="Face buttons">
        <button type="button" class="x" data-vkey="s" data-ejs-input="9" data-testid="button-gamepad-x" aria-label="X button">X</button>
        <button type="button" class="y" data-vkey="a" data-ejs-input="1" data-testid="button-gamepad-y" aria-label="Y button">Y</button>
        <button type="button" class="b" data-vkey="z" data-ejs-input="0" data-testid="button-gamepad-b" aria-label="B button">B</button>
        <button type="button" class="a" data-vkey="x" data-ejs-input="8" data-testid="button-gamepad-a" aria-label="A button">A</button>
      </div>
    </div>
    <script>
      window.CABINET_RETURN_TO = ${safeReturnTo};
    </script>
    <script src="./bootstrap.js"></script>
  </body>
</html>`;
}

function renderEmulatorBootstrap({ core, title, gameId, romId, discs }: { core: string; title: string; gameId: string; romId: number; discs: Array<{ id: number; label: string }> }) {
  return `"use strict";
function cabinetToast(message) {
  var toast = document.querySelector("#cabinet-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(window.__cabinetToastTimer);
  window.__cabinetToastTimer = window.setTimeout(function () {
    toast.classList.remove("show");
  }, 1800);
}
var cabinetLaunchProgress = 0;
var cabinetLaunchTimer = null;
function cabinetSetLaunchProgress(percent, status, stage) {
  cabinetLaunchProgress = Math.max(cabinetLaunchProgress, Math.min(100, percent));
  var overlay = document.querySelector("#cabinet-launch-overlay");
  var bar = document.querySelector("#cabinet-progress-bar");
  var percentText = document.querySelector("#cabinet-progress-percent");
  var statusText = document.querySelector("#cabinet-launch-status");
  var stageText = document.querySelector("#cabinet-progress-stage");
  if (bar) bar.style.width = cabinetLaunchProgress + "%";
  if (percentText) percentText.textContent = Math.round(cabinetLaunchProgress) + "%";
  if (statusText && status) statusText.textContent = status;
  if (stageText && stage) stageText.textContent = stage;
  if (overlay) overlay.classList.remove("is-hidden");
}
function cabinetStartLaunchProgress() {
  cabinetSetLaunchProgress(8, "Loading emulator shell…", "Starting");
  var steps = [
    { at: 20, status: "Fetching ROM data…", stage: "ROM" },
    { at: 38, status: "Loading EmulatorJS core…", stage: "Core" },
    { at: 56, status: "Preparing controls and save state…", stage: "Controls" },
    { at: 72, status: "Decompressing game core…", stage: "Decompress" },
    { at: 88, status: "Starting game…", stage: "Launching" },
    { at: 94, status: "Almost ready…", stage: "Finalizing" }
  ];
  var index = 0;
  window.clearInterval(cabinetLaunchTimer);
  cabinetLaunchTimer = window.setInterval(function () {
    if (index < steps.length) {
      var step = steps[index++];
      cabinetSetLaunchProgress(step.at, step.status, step.stage);
      return;
    }
    if (cabinetLaunchProgress < 96) {
      cabinetSetLaunchProgress(cabinetLaunchProgress + 1, "Almost ready…", "Finalizing");
    }
  }, 700);
}
function cabinetFinishLaunchProgress(status) {
  cabinetSetLaunchProgress(100, status || "Game ready", "Ready");
  window.clearInterval(cabinetLaunchTimer);
  window.setTimeout(function () {
    var overlay = document.querySelector("#cabinet-launch-overlay");
    if (overlay) overlay.classList.add("is-hidden");
  }, 450);
}
function cabinetFailLaunchProgress(message) {
  window.clearInterval(cabinetLaunchTimer);
  cabinetSetLaunchProgress(Math.max(cabinetLaunchProgress, 96), message, "Needs attention");
}
cabinetStartLaunchProgress();
var cabinetPressedKeyCounts = {};
var cabinetPressedInputCounts = {};
function cabinetKeyCode(key) {
  var codes = {
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Enter: "Enter",
    Shift: "ShiftLeft",
    z: "KeyZ",
    x: "KeyX",
    a: "KeyA",
    s: "KeyS",
    q: "KeyQ",
    w: "KeyW",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3"
  };
  return codes[key] || key;
}
function cabinetKeyEvent(type, key) {
  return new KeyboardEvent(type, {
    key: key,
    code: cabinetKeyCode(key),
    bubbles: true,
    cancelable: true
  });
}
function cabinetDispatchKey(type, key) {
  var target = document.querySelector("canvas") || document.body;
  target.focus && target.focus();
  var event = cabinetKeyEvent(type, key);
  target.dispatchEvent(event);
  document.dispatchEvent(cabinetKeyEvent(type, key));
  window.dispatchEvent(cabinetKeyEvent(type, key));
}
function cabinetKeyDown(key) {
  cabinetPressedKeyCounts[key] = (cabinetPressedKeyCounts[key] || 0) + 1;
  if (cabinetPressedKeyCounts[key] === 1) {
    cabinetDispatchKey("keydown", key);
  }
}
function cabinetKeyUp(key) {
  if (!cabinetPressedKeyCounts[key]) return;
  cabinetPressedKeyCounts[key] -= 1;
  if (cabinetPressedKeyCounts[key] <= 0) {
    delete cabinetPressedKeyCounts[key];
    cabinetDispatchKey("keyup", key);
  }
}
function cabinetSimulateInput(inputValue, pressed) {
  var emulator = window.EJS_emulator;
  var value = pressed ? 1 : 0;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.simulateInput === "function") {
    emulator.gameManager.simulateInput(0, inputValue, value);
    return true;
  }
  return false;
}
function cabinetInputDown(inputValue) {
  if (inputValue === null || Number.isNaN(inputValue)) return false;
  cabinetPressedInputCounts[inputValue] = (cabinetPressedInputCounts[inputValue] || 0) + 1;
  if (cabinetPressedInputCounts[inputValue] === 1) {
    return cabinetSimulateInput(inputValue, true);
  }
  return true;
}
function cabinetInputUp(inputValue) {
  if (inputValue === null || Number.isNaN(inputValue) || !cabinetPressedInputCounts[inputValue]) return false;
  cabinetPressedInputCounts[inputValue] -= 1;
  if (cabinetPressedInputCounts[inputValue] <= 0) {
    delete cabinetPressedInputCounts[inputValue];
    return cabinetSimulateInput(inputValue, false);
  }
  return true;
}
function cabinetPressControl(control, pressed) {
  var inputAttr = control.getAttribute("data-ejs-input");
  var inputValue = inputAttr === null ? null : Number(inputAttr);
  var usedNativeInput = pressed ? cabinetInputDown(inputValue) : cabinetInputUp(inputValue);
  var key = control.getAttribute("data-vkey");
  if (!usedNativeInput && key) {
    if (pressed) {
      cabinetKeyDown(key);
    } else {
      cabinetKeyUp(key);
    }
  }
}
function cabinetSendKey(key) {
  cabinetKeyDown(key);
  window.setTimeout(function () {
    cabinetKeyUp(key);
  }, 80);
}
function cabinetSendInput(inputValue, fallbackKey) {
  var usedNativeInput = cabinetInputDown(inputValue);
  if (!usedNativeInput && fallbackKey) {
    cabinetSendKey(fallbackKey);
    return;
  }
  window.setTimeout(function () {
    cabinetInputUp(inputValue);
  }, 80);
}
var cabinetRomId = ${JSON.stringify(romId)};
var cabinetSaveSlots = [];
var cabinetCurrentSaveSlot = 1;
function cabinetSaveStateEndpoint(slot) {
  return "./save-states" + (slot ? "/" + slot : "");
}
function cabinetRelativeTime(timestamp) {
  if (!timestamp) return "Empty slot";
  var diff = Date.now() - timestamp;
  var minute = 60 * 1000;
  var hour = 60 * minute;
  var day = 24 * hour;
  if (diff < minute) return "Saved just now";
  if (diff < hour) return "Saved " + Math.max(1, Math.round(diff / minute)) + "m ago";
  if (diff < day) return "Saved " + Math.max(1, Math.round(diff / hour)) + "h ago";
  return "Saved " + new Date(timestamp).toLocaleDateString();
}
function cabinetGetSaveSlot(slot) {
  return cabinetSaveSlots.find(function (item) {
    return item.slot === slot;
  }) || null;
}
function cabinetSetEmulatorSaveSlot(slot) {
  cabinetCurrentSaveSlot = slot;
  var emulator = window.EJS_emulator;
  if (emulator) {
    if (!emulator.settings) emulator.settings = {};
    emulator.settings["save-state-slot"] = String(slot);
    emulator.settings["save-state-location"] = "browser";
    if (typeof emulator.changeSettingOption === "function") {
      try {
        emulator.changeSettingOption("save-state-location", "browser");
        emulator.changeSettingOption("save-state-slot", String(slot));
      } catch (_error) {}
    }
  }
}
async function cabinetFetchSaveSlots() {
  try {
    var response = await fetch(cabinetSaveStateEndpoint());
    if (!response.ok) throw new Error("Save-state metadata failed");
    cabinetSaveSlots = await response.json();
  } catch (_error) {
    cabinetSaveSlots = [];
  }
  cabinetRenderSaveSlots();
}
function cabinetCaptureThumb(slot) {
  try {
    var canvas = document.querySelector("#game canvas");
    if (!canvas) return;
    var thumb = document.createElement("canvas");
    var scale = Math.min(1, 160 / canvas.width);
    thumb.width = Math.round(canvas.width * scale);
    thumb.height = Math.round(canvas.height * scale);
    var ctx = thumb.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    var dataUrl = thumb.toDataURL("image/jpeg", 0.72);
    var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
    try { localStorage.setItem(key, dataUrl); } catch (_e) {}
  } catch (_e) {}
}
function cabinetGetThumb(slot) {
  var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
  try { return localStorage.getItem(key) || null; } catch (_e) { return null; }
}
function cabinetDeleteThumb(slot) {
  var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
  try { localStorage.removeItem(key); } catch (_e) {}
}
function cabinetRenderSaveSlots() {
  var grid = document.querySelector("#cabinet-save-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (var slot = 1; slot <= 9; slot += 1) {
    var state = cabinetGetSaveSlot(slot);
    var card = document.createElement("article");
    card.className = "cabinet-save-slot";
    card.setAttribute("data-filled", state ? "true" : "false");
    card.setAttribute("data-testid", "card-save-slot-" + slot);
    var thumb = cabinetGetThumb(slot);
    var thumbHtml = state && thumb
      ? '<div class="cabinet-save-slot__thumb"><img src="' + thumb + '" alt="Save slot ' + slot + ' preview" loading="lazy"></div>'
      : '<div class="cabinet-save-slot__thumb cabinet-save-slot__thumb--empty"></div>';
    card.innerHTML =
      thumbHtml +
      '<div class="cabinet-save-slot__eyebrow">Slot ' + slot + '</div>' +
      '<div class="cabinet-save-slot__label">' + (state ? cabinetEscapeText(state.label || ("Slot " + slot)) : "Empty") + '</div>' +
      '<div class="cabinet-save-slot__meta">' + (state ? cabinetRelativeTime(state.updatedAt) : "No save data yet") + '</div>' +
      '<div class="cabinet-save-slot__actions">' +
      '<button type="button" data-save-action="save" data-slot="' + slot + '" data-testid="button-save-slot-' + slot + '">Save</button>' +
      '<button type="button" data-save-action="load" data-slot="' + slot + '" data-testid="button-load-slot-' + slot + '"' + (state ? "" : " disabled") + ">Load</button>" +
      '<button type="button" class="danger" data-save-action="delete" data-slot="' + slot + '" data-testid="button-delete-slot-' + slot + '"' + (state ? "" : " disabled") + ">Delete</button>" +
      "</div>";
    grid.appendChild(card);
  }
}
function cabinetEscapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function cabinetSetSaveManagerOpen(open) {
  var panel = document.querySelector("#cabinet-save-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) {
    cabinetSetMenuOpen(false);
  }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) {
    cabinetFetchSaveSlots();
    var closeButton = document.querySelector("#cabinet-save-manager-close");
    if (closeButton && closeButton.focus) {
      window.setTimeout(function () {
        closeButton.focus();
      }, 30);
    }
  }
}
async function cabinetRecordSaveSlot(slot) {
  var response = await fetch(cabinetSaveStateEndpoint(slot), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "Slot " + slot })
  });
  if (!response.ok) throw new Error("Could not save slot metadata");
  var saved = await response.json();
  cabinetSaveSlots = cabinetSaveSlots.filter(function (item) {
    return item.slot !== slot;
  }).concat(saved).sort(function (a, b) {
    return a.slot - b.slot;
  });
  cabinetRenderSaveSlots();
}
async function cabinetDeleteSaveSlotMetadata(slot) {
  await fetch(cabinetSaveStateEndpoint(slot), { method: "DELETE" });
  cabinetSaveSlots = cabinetSaveSlots.filter(function (item) {
    return item.slot !== slot;
  });
  cabinetRenderSaveSlots();
}
function cabinetQuickSaveSlot(slot) {
  cabinetSetEmulatorSaveSlot(slot);
  var emulator = window.EJS_emulator;
  var saved = false;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.quickSave === "function") {
    try {
      saved = !!emulator.gameManager.quickSave(String(slot));
    } catch (_error) {
      saved = false;
    }
  }
  if (!saved) {
    cabinetSendInput(24, "1");
    saved = true;
  }
  cabinetCaptureThumb(slot);
  cabinetRecordSaveSlot(slot)
    .then(function () {
      cabinetToast("Saved state to slot " + slot);
    })
    .catch(function () {
      cabinetToast("Saved locally, but metadata could not update");
    });
}
function cabinetQuickLoadSlot(slot) {
  cabinetSetEmulatorSaveSlot(slot);
  var emulator = window.EJS_emulator;
  var loaded = false;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.quickLoad === "function") {
    try {
      emulator.gameManager.quickLoad(String(slot));
      loaded = true;
    } catch (_error) {
      loaded = false;
    }
  }
  if (!loaded) {
    cabinetSendInput(25, "2");
  }
  // Only confirm success if the API call didn't throw; key-input fallback is fire-and-forget
  if (loaded) {
    cabinetToast("Loaded slot " + slot);
  } else {
    cabinetToast("Loading slot " + slot + "\u2026");
  }
}
function cabinetDeleteLocalSaveSlot(slot) {
  var emulator = window.EJS_emulator;
  if (emulator && emulator.gameManager && emulator.gameManager.FS) {
    var FS = emulator.gameManager.FS;
    var gameId = window.EJS_gameID || "";
    // EmulatorJS saves states as /{gameId}-{slot}.state in IDBFS
    var pathsToTry = [
      "/" + gameId + "-" + slot + ".state",
      "/" + gameId + "-" + slot + ".state.png",
      // Legacy / fallback paths
      "/" + slot + "-quick.state",
      slot + "-quick.state",
    ];
    for (var i = 0; i < pathsToTry.length; i++) {
      try { FS.unlink(pathsToTry[i]); } catch (_error) {}
    }
  }
  cabinetDeleteThumb(slot);
  cabinetDeleteSaveSlotMetadata(slot).then(function () {
    cabinetToast("Deleted slot " + slot);
  });
}
function cabinetSetupVirtualPad() {
  var pad = document.querySelector("#cabinet-gamepad");
  var toggle = document.querySelector("#cabinet-pad-toggle");
  var hideButton = document.querySelector("#cabinet-pad-hide");
  if (!pad || !toggle) return;
  var activePointers = {};
  var touchCapable =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0;
  var visible = !!touchCapable;
  var mobileQuery = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
  function syncMobileFlag() {
    if (mobileQuery && mobileQuery.matches) {
      document.body.classList.add("cabinet-pad-mobile");
    } else {
      document.body.classList.remove("cabinet-pad-mobile");
    }
  }
  syncMobileFlag();
  if (mobileQuery) {
    var mqHandler = function () { syncMobileFlag(); };
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener("change", mqHandler);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(mqHandler);
    }
  }
  function setPadVisible(nextVisible, announce) {
    visible = !!nextVisible;
    pad.hidden = !visible;
    pad.classList.toggle("is-visible", visible);
    document.body.classList.toggle("cabinet-pad-on", visible);
    toggle.setAttribute("aria-pressed", visible ? "true" : "false");
    toggle.textContent = visible ? "Hide Pad" : "Gamepad";
    if (announce) {
      cabinetToast(visible ? "Virtual gamepad shown" : "Virtual gamepad hidden");
    }
  }
  function releasePointer(pointerId) {
    var entry = activePointers[pointerId];
    if (!entry) return;
    delete activePointers[pointerId];
    entry.button.classList.remove("is-pressed");
    cabinetPressControl(entry.button, false);
  }
  toggle.addEventListener("click", function () {
    setPadVisible(!visible, true);
  });
  if (hideButton) {
    hideButton.addEventListener("click", function (event) {
      event.preventDefault();
      setPadVisible(false, true);
    });
  }
  pad.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
  pad.querySelectorAll("[data-ejs-input]").forEach(function (button) {
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      if (activePointers[event.pointerId]) {
        releasePointer(event.pointerId);
      }
      activePointers[event.pointerId] = { button: button };
      button.classList.add("is-pressed");
      if (button.setPointerCapture) {
        try {
          button.setPointerCapture(event.pointerId);
        } catch (_error) {}
      }
      cabinetPressControl(button, true);
    });
    button.addEventListener("pointerup", function (event) {
      event.preventDefault();
      releasePointer(event.pointerId);
    });
    button.addEventListener("pointercancel", function (event) {
      releasePointer(event.pointerId);
    });
    button.addEventListener("lostpointercapture", function (event) {
      releasePointer(event.pointerId);
    });
  });
  window.addEventListener("blur", function () {
    Object.keys(activePointers).forEach(function (pointerId) {
      releasePointer(pointerId);
    });
    Object.keys(cabinetPressedKeyCounts).forEach(function (key) {
      cabinetPressedKeyCounts[key] = 1;
      cabinetKeyUp(key);
    });
    Object.keys(cabinetPressedInputCounts).forEach(function (inputValue) {
      cabinetPressedInputCounts[inputValue] = 1;
      cabinetInputUp(Number(inputValue));
    });
  });
  setPadVisible(visible, false);
}
function cabinetSetMenuOpen(open) {
  var button = document.querySelector("#cabinet-menu-toggle");
  var panel = document.querySelector("#cabinet-menu-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!button || !panel || !backdrop) return;
  button.setAttribute("aria-expanded", open ? "true" : "false");
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) {
    var resume = document.querySelector("#cabinet-resume");
    if (resume && resume.focus) {
      window.setTimeout(function () {
        resume.focus();
      }, 30);
    }
  }
}
function cabinetSetupSystemMenu() {
  var button = document.querySelector("#cabinet-menu-toggle");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!button || !backdrop) return;
  button.addEventListener("click", function () {
    var isOpen = button.getAttribute("aria-expanded") === "true";
    cabinetSetMenuOpen(!isOpen);
  });
  backdrop.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    cabinetSetSaveManagerOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cabinetSetMenuOpen(false);
      cabinetSetSaveManagerOpen(false);
    }
  });
}
document.addEventListener("click", function (event) {
  var target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "cabinet-resume") {
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-exit") {
    var returnTo = window.CABINET_RETURN_TO || "";
    var duration = cabinetSessionStart ? Math.round((Date.now() - cabinetSessionStart) / 1000) : 0;
    var doExit = function () {
      if (returnTo) { window.location.href = returnTo; return; }
      if (window.opener) { window.close(); return; }
      window.location.href = "/";
    };
    fetch("./play-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "ended", durationSeconds: duration }),
    }).catch(function () {}).finally(doExit);
  }
  if (target.id === "cabinet-save") {
    cabinetQuickSaveSlot(cabinetCurrentSaveSlot);
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-load") {
    cabinetQuickLoadSlot(cabinetCurrentSaveSlot);
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-save-manager-open") {
    cabinetSetSaveManagerOpen(true);
  }
  if (target.id === "cabinet-save-manager-close") {
    cabinetSetSaveManagerOpen(false);
  }
  var saveAction = target.getAttribute("data-save-action");
  if (saveAction) {
    var slot = Number(target.getAttribute("data-slot"));
    if (!Number.isNaN(slot)) {
      if (saveAction === "save") {
        cabinetQuickSaveSlot(slot);
      }
      if (saveAction === "load") {
        cabinetQuickLoadSlot(slot);
        cabinetSetSaveManagerOpen(false);
      }
      if (saveAction === "delete") {
        cabinetDeleteLocalSaveSlot(slot);
      }
    }
  }
  if (target.id === "cabinet-pad-toggle") {
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-controls") {
    cabinetSetMenuOpen(false);
    var isPsx = window.CABINET_CORE === "psx" || window.CABINET_CORE === "pcsx2";
    cabinetToast(isPsx
      ? "PS1/PS2: Cross Z, Circle X, Square A, Triangle S, L1 Q, R1 W, L2 E, R2 R, L3 Tab, R3 C. Save 1, Load 2. Rewind Backspace."
      : "Keyboard and pad: arrows, A/B/X/Y, Start Enter, Select Shift, L1 Q, R1 W. Save 1, Load 2. Rewind Backspace.");
  }
  if (target.id === "cabinet-rewind-toggle") {
    var rewindOn = target.getAttribute("aria-pressed") === "true";
    cabinetSetMenuOpen(false);
    cabinetSetRewind(!rewindOn);
  }
  if (target.id === "cabinet-ff-toggle") {
    var ffOn = target.getAttribute("aria-pressed") === "true";
    cabinetSetMenuOpen(false);
    cabinetSetFastForward(!ffOn);
  }
  if (target.id === "cabinet-cheats") {
    cabinetOpenCheats();
  }
  if (target.id === "cabinet-screenshot") {
    cabinetTakeScreenshot();
  }
  if (target.id === "cabinet-display-open") {
    cabinetSetDisplayPanel(true);
  }
  if (target.id === "cabinet-display-close") {
    cabinetSetDisplayPanel(false);
  }
  if (target.id === "cabinet-remap-open") {
    cabinetSetRemapPanel(true);
  }
  if (target.id === "cabinet-remap-close") {
    cabinetSetRemapPanel(false);
  }
  if (target.id === "cabinet-remap-reset") {
    try { localStorage.removeItem(cabinetRemapStorageKey()); } catch (_e) {}
    cabinetRemapTarget = null;
    cabinetRenderRemapGrid();
    cabinetToast("Controls reset to defaults");
  }
  if (target.hasAttribute && target.hasAttribute("data-remap-index")) {
    var remapIndex = parseInt(target.getAttribute("data-remap-index"), 10);
    cabinetRemapTarget = { index: remapIndex };
    cabinetRenderRemapGrid();
  }
  if (target.dataset && target.dataset.aspect) {
    cabinetApplyAspect(target.dataset.aspect);
  }
  if (target.dataset && target.dataset.filter) {
    cabinetApplyFilter(target.dataset.filter);
  }
});
function cabinetSetRewind(enabled) {
  var btn = document.querySelector("#cabinet-rewind-toggle");
  if (btn) btn.setAttribute("aria-pressed", String(enabled));
  var emulator = window.EJS_emulator;
  if (emulator && emulator.toggleRewind) {
    emulator.toggleRewind(enabled);
  } else if (emulator && emulator.gameManager) {
    // Fallback: set the rewind flag directly
    window.EJS_rewindEnabled = enabled;
  }
  cabinetToast(enabled ? "Rewind ON — hold Backspace" : "Rewind OFF");
}
function cabinetSetFastForward(enabled) {
  var btn = document.querySelector("#cabinet-ff-toggle");
  if (btn) btn.setAttribute("aria-pressed", String(enabled));
  var emulator = window.EJS_emulator;
  if (emulator && emulator.setFastForward) {
    emulator.setFastForward(enabled);
  } else if (emulator && emulator.gameManager && emulator.gameManager.Module) {
    try { emulator.gameManager.Module.setFastForward(enabled ? 1 : 0); } catch (_e) {}
  }
  cabinetToast(enabled ? "Fast-forward ON (3×)" : "Fast-forward OFF");
}
function cabinetOpenCheats() {
  cabinetSetMenuOpen(false);
  var emulator = window.EJS_emulator;
  if (emulator && emulator.openCheatMenu) {
    emulator.openCheatMenu();
  } else if (emulator && emulator.callEvent) {
    emulator.callEvent("cheat");
  } else {
    cabinetToast("Cheat menu not available for this core");
  }
}
function cabinetTakeScreenshot() {
  cabinetSetMenuOpen(false);
  var emulator = window.EJS_emulator;
  var canvas = document.querySelector("#game canvas");
  if (!canvas) {
    cabinetToast("No game canvas found");
    return;
  }
  try {
    var dataUrl = canvas.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = dataUrl;
    a.download = (window.EJS_gameName || "screenshot") + "-" + Date.now() + ".png";
    a.click();
    cabinetToast("Screenshot saved!");
  } catch (_e) {
    cabinetToast("Screenshot failed (cross-origin canvas)");
  }
}
function cabinetSetDisplayPanel(open) {
  var panel = document.querySelector("#cabinet-display-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) cabinetSetMenuOpen(false);
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
}
function cabinetApplyAspect(aspect) {
  var game = document.querySelector("#game");
  if (!game) return;
  var canvas = game.querySelector("canvas");
  if (!canvas) return;
  game.style.display = "flex";
  game.style.alignItems = "center";
  game.style.justifyContent = "center";
  switch (aspect) {
    case "4:3":
      canvas.style.width = ""; canvas.style.height = "100%";
      canvas.style.aspectRatio = "4/3"; canvas.style.maxWidth = "100%";
      break;
    case "16:9":
      canvas.style.width = ""; canvas.style.height = "100%";
      canvas.style.aspectRatio = "16/9"; canvas.style.maxWidth = "100%";
      break;
    case "pixel":
      canvas.style.width = ""; canvas.style.height = "";
      canvas.style.aspectRatio = ""; canvas.style.maxWidth = "100%";
      canvas.style.imageRendering = "pixelated";
      break;
    case "stretch":
      canvas.style.width = "100%"; canvas.style.height = "100%";
      canvas.style.aspectRatio = ""; canvas.style.maxWidth = "";
      break;
  }
  var btns = document.querySelectorAll("[data-aspect]");
  btns.forEach(function (b) {
    b.setAttribute("aria-checked", b.getAttribute("data-aspect") === aspect ? "true" : "false");
  });
  try { localStorage.setItem("cabinet_aspect", aspect); } catch (_e) {}
}
function cabinetApplyFilter(filter) {
  var game = document.querySelector("#game");
  if (!game) return;
  game.classList.remove("cabinet-filter-crt", "cabinet-filter-smooth");
  if (filter !== "none") game.classList.add("cabinet-filter-" + filter);
  var btns = document.querySelectorAll("[data-filter]");
  btns.forEach(function (b) {
    b.setAttribute("aria-checked", b.getAttribute("data-filter") === filter ? "true" : "false");
  });
  try { localStorage.setItem("cabinet_filter", filter); } catch (_e) {}
}
function cabinetInitDisplay() {
  try {
    var aspect = localStorage.getItem("cabinet_aspect") || "4:3";
    var filter = localStorage.getItem("cabinet_filter") || "none";
    window.setTimeout(function () {
      cabinetApplyAspect(aspect);
      cabinetApplyFilter(filter);
    }, 500);
  } catch (_e) {}
}
// ── Per-game key remapping ─────────────────────────────────────────────────
var cabinetRemapTarget = null; // { player, index, label }
var CABINET_BUTTON_LABELS = [
  "Cross / A", "Square / B", "Select", "Start",
  "D-Pad Up", "D-Pad Down", "D-Pad Left", "D-Pad Right",
  "Circle / A2", "Triangle / B2", "L1", "R1", "L2", "R2", "L3", "R3",
];
function cabinetRemapStorageKey() {
  return "cabinet_remap_" + (window.EJS_gameID || "game");
}
function cabinetLoadRemap() {
  try {
    var raw = localStorage.getItem(cabinetRemapStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}
function cabinetSaveRemap(mapping) {
  try { localStorage.setItem(cabinetRemapStorageKey(), JSON.stringify(mapping)); } catch (_e) {}
}
function cabinetApplyRemap(mapping) {
  if (!mapping) return;
  var emulator = window.EJS_emulator;
  if (!emulator) return;
  Object.keys(mapping).forEach(function (indexStr) {
    var index = parseInt(indexStr, 10);
    var key = mapping[indexStr];
    if (emulator.settings) {
      emulator.settings["p1_" + index] = key;
    }
    if (typeof emulator.changeSettingOption === "function") {
      try { emulator.changeSettingOption("p1_" + index, key); } catch (_e) {}
    }
    if (window.EJS_defaultControls && window.EJS_defaultControls[0]) {
      if (!window.EJS_defaultControls[0][index]) window.EJS_defaultControls[0][index] = {};
      window.EJS_defaultControls[0][index].value = key;
    }
  });
}
function cabinetSetRemapPanel(open) {
  var panel = document.querySelector("#cabinet-remap-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) { cabinetSetMenuOpen(false); cabinetRenderRemapGrid(); }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (!open) cabinetRemapTarget = null;
}
function cabinetRenderRemapGrid() {
  var grid = document.querySelector("#cabinet-remap-grid");
  if (!grid) return;
  var mapping = cabinetLoadRemap() || {};
  var defaultControls = (window.EJS_defaultControls && window.EJS_defaultControls[0]) || {};
  var labels = window.CABINET_CORE === "psx" || window.CABINET_CORE === "pcsx2"
    ? ["Cross", "Square", "Select", "Start", "Up", "Down", "Left", "Right", "Circle", "Triangle", "L1", "R1", "L2", "R2", "L3", "R3"]
    : CABINET_BUTTON_LABELS;
  grid.innerHTML = "";
  labels.forEach(function (label, index) {
    var currentKey = mapping[index] || (defaultControls[index] && defaultControls[index].value) || "—";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;";
    var nameEl = document.createElement("span");
    nameEl.style.cssText = "color:rgba(248,250,252,0.7);font:700 9px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;";
    nameEl.textContent = label;
    var keyBtn = document.createElement("button");
    keyBtn.type = "button";
    keyBtn.setAttribute("data-remap-index", String(index));
    keyBtn.style.cssText = "appearance:none;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.08);color:#f8fafc;cursor:pointer;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;min-width:72px;padding:8px 10px;text-transform:uppercase;";
    keyBtn.textContent = currentKey;
    if (cabinetRemapTarget && cabinetRemapTarget.index === index) {
      keyBtn.style.borderColor = "rgba(236,72,153,0.9)";
      keyBtn.style.background = "rgba(236,72,153,0.25)";
      keyBtn.textContent = "Press key…";
    }
    row.appendChild(nameEl);
    row.appendChild(keyBtn);
    grid.appendChild(row);
  });
}
document.addEventListener("keydown", function (e) {
  if (!cabinetRemapTarget) return;
  e.preventDefault();
  e.stopPropagation();
  var key = e.key.toLowerCase();
  if (key === "escape") { cabinetRemapTarget = null; cabinetRenderRemapGrid(); return; }
  var mapping = cabinetLoadRemap() || {};
  mapping[cabinetRemapTarget.index] = key;
  cabinetSaveRemap(mapping);
  cabinetApplyRemap(mapping);
  cabinetRemapTarget = null;
  cabinetRenderRemapGrid();
  cabinetToast("Mapped to " + key);
}, true);
// Apply saved remap when game starts
window.addEventListener("EJS_emulator_ready", function () {
  cabinetApplyRemap(cabinetLoadRemap());
});
cabinetSetupSystemMenu();
cabinetSetupVirtualPad();
cabinetFetchSaveSlots();
window.EJS_ready = function () {
  cabinetSetLaunchProgress(62, "Emulator ready. Loading game…", "Core ready");
};
var cabinetSessionStart = 0;
window.EJS_onGameStart = function () {
  cabinetFinishLaunchProgress("Game ready");
  cabinetInitDisplay();
  cabinetSessionStart = Date.now();
  fetch("./play-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "started" }),
  }).catch(function () {});
};
window.EJS_player = "#game";
window.EJS_core = ${JSON.stringify(core)};
window.CABINET_CORE = ${JSON.stringify(core)};
window.EJS_gameName = ${JSON.stringify(title)};
window.EJS_gameID = ${JSON.stringify(gameId)};
${discs.length > 1
  ? `window.EJS_discs = ${JSON.stringify(discs.map((d) => ({ fileName: `../\${d.id}/file`, label: d.label })))};`
  : `window.EJS_gameUrl = "./file";`}
window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
window.EJS_startOnLoaded = true;
window.EJS_AdUrl = "";
window.EJS_rewindEnabled = true;
window.EJS_rewindGranularity = 2;
window.EJS_fastForwardSpeed = 3;
window.EJS_controlScheme = ${JSON.stringify(core)};
window.EJS_defaultControls = {
  0: {
    0: { value: "z", value2: "BUTTON_1" },
    1: { value: "a", value2: "BUTTON_4" },
    2: { value: "shift", value2: "SELECT" },
    3: { value: "enter", value2: "START" },
    4: { value: "up arrow", value2: "DPAD_UP" },
    5: { value: "down arrow", value2: "DPAD_DOWN" },
    6: { value: "left arrow", value2: "DPAD_LEFT" },
    7: { value: "right arrow", value2: "DPAD_RIGHT" },
    8: { value: "x", value2: "BUTTON_2" },
    9: { value: "s", value2: "BUTTON_3" },
    10: { value: "q", value2: "LEFT_TOP_SHOULDER" },
    11: { value: "w", value2: "RIGHT_TOP_SHOULDER" },
${["psx", "pcsx2"].includes(core) ? `
    12: { value: "e", value2: "LEFT_BOTTOM_SHOULDER" },
    13: { value: "r", value2: "RIGHT_BOTTOM_SHOULDER" },
    14: { value: "tab", value2: "LEFT_ANALOG" },
    15: { value: "c", value2: "RIGHT_ANALOG" },` : ""}
    24: { value: "1" },
    25: { value: "2" },
    26: { value: "3" }
  },
  1: {},
  2: {},
  3: {}
};
window.EJS_defaultOptions = {
  "save-state-location": "browser",
  "save-state-slot": 1
};
window.EJS_Buttons = {
  playPause: true,
  restart: true,
  mute: true,
  settings: true,
  fullscreen: true,
  saveState: true,
  loadState: true,
  screenRecord: false,
  gamepad: true,
  cheat: true,
  volume: true,
  saveSavFiles: true,
  loadSavFiles: true,
  quickSave: true,
  quickLoad: true,
  screenshot: true,
  cacheManager: true,
  exitEmulation: true
};
var loader = document.createElement("script");
loader.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
loader.onload = function () {
  cabinetSetLaunchProgress(42, "Emulator loader downloaded…", "Loader");
};
loader.onerror = function () {
  cabinetFailLaunchProgress("Emulator loader blocked. Try the standalone player or local Home Assistant add-on.");
  var game = document.querySelector("#game");
  if (game) game.innerHTML = '<div class="loading"><div>Emulator loader blocked</div><div class="hint">The preview frame could not load EmulatorJS from the CDN. The Home Assistant local add-on will avoid this by serving the emulator locally.</div></div>';
};
document.body.appendChild(loader);
`;
}

function renderPlayerError(message: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        display: grid;
        place-items: center;
        background: #050507;
        color: #f8fafc;
        font: 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    </style>
  </head>
  <body>${escapeHtml(message)}</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
