import type { Express } from "express";
import type { Server } from 'node:http';
import { storage } from "./storage";
import { dataPath } from "./data-dir";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
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

// In-memory "now playing" state — tracks the game currently open in the browser player
let nowPlayingRom: { id: number; title: string; system: string } | null = null;
let activeSessionId: number | null = null;
let activeSessionStart = 0;


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
  gb: [".gb", ".zip", ".7z"],
  gbc: [".gbc", ".zip", ".7z"],
  nds: [".nds", ".zip", ".7z"],
  psp: [".iso", ".cso", ".pbp", ".zip", ".7z"],
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
  dreamcast: "reicast",
  gb: "gambatte",
  gbc: "gambatte",
  nds: "melonds",
  psp: "ppsspp",
  atari2600: "stella2014",
  saturn: "yabause",
  gamegear: "smsgg",
  sms: "smsgg",
  pce: "pce",
  sega32x: "picodrive",
  segacd: "segaCD",
  neogeo: "fbneo",
  virtualboy: "beetle_vb",
  atari7800: "prosystem",
  lynx: "mednafen_lynx",
};

const ROM_ROOT = path.resolve(dataPath("rom-storage"));
const SAVE_BACKUP_DIR = path.resolve(dataPath("save-backups"));
const SYSTEM_IMAGE_CACHE_DIR = path.resolve(dataPath("system-image-cache"));
const SYSTEM_LOGO_CACHE_DIR  = path.resolve(dataPath("system-logo-cache"));
const SYSTEM_IMAGE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "CabinetBridge/0.4 (+https://github.com/GlerschNersch/token; mailto:noreply@anthropic.com) Mozilla/5.0",
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
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  nds: "Nintendo - Nintendo DS",
  psp: "Sony - PlayStation Portable",
  atari2600: "Atari - 2600",
  saturn: "Sega - Saturn",
  gamegear: "Sega - Game Gear",
  sms: "Sega - Master System - Mark III",
  pce: "NEC - PC Engine - TurboGrafx 16",
  sega32x: "Sega - 32X",
  segacd: "Sega - Mega-CD - Sega CD",
  neogeo: "SNK - Neo Geo",
  virtualboy: "Nintendo - Virtual Boy",
  atari7800: "Atari - 7800",
  lynx: "Atari - Lynx",
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


function getUserFromRequest(req: import("express").Request): { userId: string; userName: string } {
  const rawId =
    (req.headers["x-remote-user-id"] as string | undefined) ||
    (req.headers["x-hass-user-id"] as string | undefined) ||
    (req.headers["x-remote-user"] as string | undefined) ||
    "default";
  const rawName =
    (req.headers["x-remote-user-name"] as string | undefined) ||
    (req.headers["x-hass-user"] as string | undefined) ||
    rawId;
  const userId = rawId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "default";
  const userName = rawName.slice(0, 128) || userId;
  return { userId, userName };
}


// ---------------------------------------------------------------------------
// Auto-configure HA panel_iframe so HomeArcade is accessible to all HA users.
// Runs once at startup inside the HA add-on environment (SUPERVISOR_TOKEN set).
// Writes a panel_iframe entry to /config/configuration.yaml if not already
// present, then asks HA to reload integrations so the panel appears immediately.
// ---------------------------------------------------------------------------
async function ensurePanelIframe(): Promise<void> {
  const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
  if (!SUPERVISOR_TOKEN) return; // not running inside HA add-on

  const CONFIG_PATH = "/config/configuration.yaml";
  const MARKER = "# homearcade-panel-iframe-auto";

  try {
    // Ask the Supervisor for our own ingress URL
    const infoRes = await fetch("http://supervisor/addons/self/info", {
      headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` },
    });
    if (!infoRes.ok) return;
    const info = (await infoRes.json()) as { data?: { ingress_entry?: string } };
    const ingressUrl = info.data?.ingress_entry;
    if (!ingressUrl) return;

    // Read the existing configuration.yaml
    let configYaml: string;
    try {
      configYaml = await fs.readFile(CONFIG_PATH, "utf8");
    } catch {
      return; // /config not mounted or not accessible
    }

    // Already done on a previous startup
    if (configYaml.includes(MARKER)) return;

    // Build our panel_iframe entry block
    const panelEntry = [
      `  homearcade:`,
      `    title: HomeArcade`,
      `    url: "${ingressUrl}"`,
      `    icon: mdi:gamepad-variant`,
      `    require_admin: false`,
    ].join("\n");

    let updated: string;
    if (/^panel_iframe:/m.test(configYaml)) {
      // Slot our entry into the existing panel_iframe section
      updated = configYaml.replace(
        /^(panel_iframe:)/m,
        `$1\n${panelEntry}`
      );
    } else {
      // Append a brand-new panel_iframe section
      updated =
        configYaml.trimEnd() +
        `\n\n${MARKER}\npanel_iframe:\n${panelEntry}\n`;
    }

    await fs.writeFile(CONFIG_PATH, updated, "utf8");

    // Best-effort: ask HA to reload integrations immediately
    await fetch(
      "http://supervisor/homeassistant/api/services/homeassistant/reload_all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }
    ).catch(() => {/* reload is best-effort */});

    console.log(
      "[HomeArcade] panel_iframe auto-configured — HomeArcade is now visible to all HA users"
    );
  } catch (err) {
    console.error("[HomeArcade] panel_iframe auto-config error:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auto-configure HA panel_iframe so all HA users can access HomeArcade
  ensurePanelIframe().catch(() => {});

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


  // Video preview proxy — streams the ScreenScraper video so the browser
  // doesn't hit CORS issues fetching directly from screenscraper.fr
  // GET /api/roms/:id/video
  app.get("/api/roms/:id/video", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const videoUrl = (rom as Record<string, unknown>).videoUrl as string | null;
    if (!videoUrl) return res.status(404).json({ message: "No video available." });
    try {
      const upstream = await fetch(videoUrl, {
        headers: { "User-Agent": "CabinetBridge/0.1" },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({ message: "Failed to fetch video." });
      }
      res.setHeader("Content-Type", upstream.headers.get("Content-Type") ?? "video/mp4");
      const cl = upstream.headers.get("Content-Length");
      if (cl) res.setHeader("Content-Length", cl);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const { Readable } = await import("stream");
      Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
    } catch {
      res.status(502).json({ message: "Video fetch error." });
    }
  });


  // EmulatorJS CDN proxy — fetches EmulatorJS assets server-side so the
  // browser never needs to reach an external CDN through HA Ingress.
  // GET /api/emulatorjs/* → https://cdn.emulatorjs.org/stable/data/*
  app.get("/api/emulatorjs/*path", async (req: import("express").Request, res: import("express").Response) => {
    const filePath = Array.isArray(req.params.path) ? (req.params.path as string[]).join("/") : ((req.params as Record<string, string>).path ?? "");
    if (!filePath || filePath.includes("..")) {
      return res.status(400).send("Invalid path");
    }
    const cdnUrl = `https://cdn.emulatorjs.org/stable/data/${filePath}`;
    try {
      const upstream = await fetch(cdnUrl, {
        headers: { "User-Agent": "CabinetBridge/0.1" },
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok || !upstream.body) {
        return res.status(upstream.status).send("CDN error");
      }
      const ct = upstream.headers.get("Content-Type") ?? "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=604800"); // 7 days
      // NOTE: Do NOT forward Content-Length — Node fetch decompresses gzip bodies
      // so the CDN's compressed Content-Length would be wrong, truncating the script.
      const { Readable } = await import("stream");
      Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
    } catch {
      res.status(502).send("EmulatorJS CDN unreachable");
    }
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
    res.send(renderEmulatorPage({ title: rom.title, returnTo, romHash: rom.romHash ?? null }));
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

    const bootstrapSettings = await storage.getIntegrationSettings();
    const { userId, userName } = getUserFromRequest(req);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(renderEmulatorBootstrap({
      core,
      title: rom.title,
      gameId: `${rom.system}-${rom.slug}`,
      romId: rom.id,
      discs,
      romHash: rom.romHash ?? null,
      raUsername: bootstrapSettings.raUsername ?? "",
      raToken: bootstrapSettings.raToken ?? "",
      controlDefaults: (bootstrapSettings.controlDefaults ?? {}) as Record<string, Record<number, string>>,
      userId,
      userName,
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

  app.patch("/api/roms/:id/play-status", async (req, res) => {
    const id = Number(req.params.id);
    const VALID = ["unset", "backlog", "playing", "completed", "dropped"];
    const parsed = z.object({ playStatus: z.string() }).safeParse(req.body);
    if (!parsed.success || !VALID.includes(parsed.data.playStatus)) {
      return res.status(400).json({ message: "Invalid play status." });
    }
    const updated = await storage.updateUploadedRomPlayStatus(id, parsed.data.playStatus);
    if (!updated) return res.status(404).json({ message: "Uploaded ROM not found." });
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

    const { userId } = getUserFromRequest(req);
    const slots = await storage.listRomSaveSlots(romId, userId);
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
    const { userId } = getUserFromRequest(req);
    const saveSlot = insertRomSaveSlotSchema.parse({
      romId,
      userId,
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

    const { userId: delUserId } = getUserFromRequest(req);
    await storage.deleteRomSaveSlot(romId, slot, delUserId);
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
      const romHash = crypto.createHash("md5").update(body).digest("hex");

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
        communityScore: ssMeta?.communityScore ?? null,
        wheelArtUrl: ssMeta?.wheelArtUrl ?? null,
        videoUrl: ssMeta?.videoUrl ?? null,
        favorite,
        rating: 0,
        lastPlayed: 0,
        playCount: 0,
        discNumber,
        discGroup,
        romHash,
        minutesPlayed: 0,
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
      // Return a subtle SVG placeholder instead of 404 so the UI degrades
      // gracefully when Wikimedia is unreachable from the addon network.
      const label = id.toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="#1a1a2e"/>
  <text x="320" y="248" font-family="ui-monospace,monospace" font-size="32" font-weight="700"
        fill="rgba(248,250,252,0.15)" text-anchor="middle" dominant-baseline="middle"
        letter-spacing="0.2em">${label}</text>
</svg>`;
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(svg);
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

  // ── System logo proxy (SVG) ────────────────────────────────────────────────
  // Client loads logos through this same-origin proxy so HA Ingress CORS
  // restrictions never block them (Wikimedia doesn't send CORS headers when
  // fetched cross-origin through Ingress).
  const SYSTEM_LOGOS: Record<string, string> = {
    nes:       "https://commons.wikimedia.org/wiki/Special:FilePath/NES-logo.svg",
    snes:      "https://commons.wikimedia.org/wiki/Special:FilePath/Super_Nintendo_Entertainment_System_logo.svg",
    n64:       "https://commons.wikimedia.org/wiki/Special:FilePath/Nintendo_64_logo.svg",
    gba:       "https://commons.wikimedia.org/wiki/Special:FilePath/Game_Boy_Advance_logo.svg",
    genesis:   "https://commons.wikimedia.org/wiki/Special:FilePath/Sega-Genesis-Logo.svg",
    ps1:       "https://commons.wikimedia.org/wiki/Special:FilePath/PlayStation_Logo.svg",
    ps2:       "https://commons.wikimedia.org/wiki/Special:FilePath/PlayStation_2_logo.svg",
    psp:       "https://commons.wikimedia.org/wiki/Special:FilePath/PlayStation_Portable_logo.svg",
    dreamcast: "https://commons.wikimedia.org/wiki/Special:FilePath/Dreamcast_logo.svg",
    gb:        "https://commons.wikimedia.org/wiki/Special:FilePath/Game_Boy_logo.svg",
    gbc:       "https://commons.wikimedia.org/wiki/Special:FilePath/Game_Boy_Color_logo.svg",
    nds:       "https://commons.wikimedia.org/wiki/Special:FilePath/Nintendo_DS_Logo.svg",
    arcade:    "https://commons.wikimedia.org/wiki/Special:FilePath/MAME_Logo.svg",
    atari2600: "https://commons.wikimedia.org/wiki/Special:FilePath/Atari-logo.svg",
    saturn:    "https://commons.wikimedia.org/wiki/Special:FilePath/Sega_Saturn_logo.svg",
    gamegear:  "https://commons.wikimedia.org/wiki/Special:FilePath/Sega_Game_Gear_logo.svg",
    sms:       "https://commons.wikimedia.org/wiki/Special:FilePath/Sega_Master_System_logo.svg",
    pce:       "https://commons.wikimedia.org/wiki/Special:FilePath/TurboGrafx16-logo.svg",
    sega32x:   "https://commons.wikimedia.org/wiki/Special:FilePath/Sega-32X-logo.svg",
    segacd:    "https://commons.wikimedia.org/wiki/Special:FilePath/Sega-CD-logo.svg",
    neogeo:    "https://commons.wikimedia.org/wiki/Special:FilePath/Neo-Geo-logo.svg",
    virtualboy:"https://commons.wikimedia.org/wiki/Special:FilePath/Virtual-Boy-logo.svg",
    atari7800: "https://commons.wikimedia.org/wiki/Special:FilePath/Atari-logo.svg",
    lynx:      "https://commons.wikimedia.org/wiki/Special:FilePath/Atari-logo.svg",
  };

  app.get("/api/system-logos/:id", async (req, res) => {
    const id = String(req.params.id);
    const upstreamUrl = SYSTEM_LOGOS[id];
    if (!upstreamUrl) {
      return res.status(404).json({ message: "Unknown system logo id." });
    }
    await fs.mkdir(SYSTEM_LOGO_CACHE_DIR, { recursive: true });
    const cachePath = path.join(SYSTEM_LOGO_CACHE_DIR, `${id}.svg`);
    // Serve from disk cache if present
    try {
      const stat = await fs.stat(cachePath);
      if (stat.size > 0) {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        return res.sendFile(cachePath);
      }
    } catch { /* cache miss */ }
    // Fetch from Wikimedia server-side (avoids browser CORS entirely)
    try {
      const response = await fetch(upstreamUrl, {
        headers: { "User-Agent": "HomeArcade/1.0 (home-assistant-addon; +https://github.com/GlerschNersch/token)" },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`Upstream ${response.status}`);
      const text = await response.text();
      if (text.length > 0) {
        await fs.writeFile(cachePath, text, "utf8");
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        return res.send(text);
      }
      throw new Error("Empty SVG body");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch logo.";
      return res.status(502).json({ message: msg });
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
      communityScore: ssMeta?.communityScore ?? undefined,
      wheelArtUrl: ssMeta?.wheelArtUrl ?? undefined,
      videoUrl: ssMeta?.videoUrl ?? undefined,
    });
    res.json(updated);
  });

  // Bulk art scrape — SSE stream so the client can show live progress.
  // POST /api/roms/scrape-all
  // Optional body: { force: true } to re-scrape already-matched ROMs.
  app.post("/api/roms/scrape-all", express.json(), async (req, res) => {
    const force = !!(req.body as Record<string, unknown>)?.force;
    const roms = await storage.listUploadedRoms();
    const targets = force ? roms : roms.filter((r) => r.scrapeStatus !== "matched");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: "start", total: targets.length });

    const settings = await storage.getIntegrationSettings();
    let matched = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const rom = targets[i];
      send({ type: "progress", index: i, id: rom.id, title: rom.title, total: targets.length });

      try {
        const ssMeta = await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.ssUserId, settings.ssPassword);
        const libretroArt = ssMeta?.artUrl ? null : await findLibretroBoxArt(rom.system, rom.title);
        const status = ssMeta?.scrapeStatus ?? (libretroArt?.url ? "matched" : "not_found");

        await storage.updateUploadedRomMetadata(rom.id, {
          artUrl: ssMeta?.artUrl ?? libretroArt?.url ?? null,
          scrapeStatus: status,
          scrapeMessage: ssMeta?.scrapeMessage ?? libretroArt?.message ?? "",
          description: ssMeta?.description ?? undefined,
          releaseYear: ssMeta?.releaseYear ?? undefined,
          developer: ssMeta?.developer ?? undefined,
          publisher: ssMeta?.publisher ?? undefined,
          genre: ssMeta?.genre ?? undefined,
          players: ssMeta?.players ?? undefined,
          communityScore: ssMeta?.communityScore ?? undefined,
          wheelArtUrl: ssMeta?.wheelArtUrl ?? undefined,
          videoUrl: ssMeta?.videoUrl ?? undefined,
        });

        if (status === "matched") matched++;
        else failed++;

        send({ type: "result", id: rom.id, title: rom.title, status, index: i, total: targets.length });
      } catch (err) {
        failed++;
        send({ type: "result", id: rom.id, title: rom.title, status: "error", error: String(err), index: i, total: targets.length });
      }

      // Polite delay to avoid hammering ScreenScraper rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    send({ type: "done", matched, failed, total: targets.length });
    res.end();
  });

  // Kiosk mode config — public so the client can read it before auth
  app.get("/api/retroachievements/game-info/:id", async (req, res) => {
    const id = Number(req.params.id);
    const settings = await storage.getIntegrationSettings();
    if (!settings.raUsername || !settings.raToken) {
      return res.status(401).json({ message: "RetroAchievements not configured." });
    }
    const url = `https://retroachievements.org/API/API_GetGame.php?z=${settings.raUsername}&y=${settings.raToken}&i=${id}`;
    try {
      const upstream = await fetch(url);
      const data = await upstream.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.get("/api/retroachievements/user-progress/:id", async (req, res) => {
    const id = Number(req.params.id);
    const settings = await storage.getIntegrationSettings();
    if (!settings.raUsername || !settings.raToken) {
      return res.status(401).json({ message: "RetroAchievements not configured." });
    }
    const url = `https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=${settings.raUsername}&y=${settings.raToken}&u=${settings.raUsername}&g=${id}`;
    try {
      const upstream = await fetch(url);
      const data = await upstream.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
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

    // Track "now playing" in memory and log to play_sessions
    if (event === "started") {
      nowPlayingRom = { id: rom.id, title: rom.title, system: rom.system };
      activeSessionStart = Date.now();
      activeSessionId = await storage.createPlaySession(rom.id, rom.title, rom.system, activeSessionStart).catch(() => null);
    } else {
      nowPlayingRom = null;
      if (activeSessionId) {
        const endedAt = Date.now();
        const dur = durationSeconds ?? Math.round((endedAt - activeSessionStart) / 1000);
        await storage.endPlaySession(activeSessionId, endedAt, dur).catch(() => {});
        activeSessionId = null;
      }
    }

    const settings = await storage.getIntegrationSettings();
    // Accumulate real play time
    if (event === "ended" && durationSeconds && durationSeconds > 0) {
      const minutes = durationSeconds / 60;
      await storage.incrementRomMinutesPlayed(id, minutes).catch(() => {});
    }

    if (settings.haBaseUrl && settings.haToken) {
      const eventType = event === "started" ? "homearcade_game_started" : "homearcade_game_ended";
      const payload = {
        game: rom.title,
        system: rom.system,
        rom_id: rom.id,
        players: rom.players ?? 1,
        developer: rom.developer ?? "Unknown",
        genre: rom.genre ?? "Action",
        ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
      };
      try {
        // Fire HA event
        await fetch(`${settings.haBaseUrl}/api/events/${eventType}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.haToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });
        // Also update input_text.homearcade_now_playing helper (if it exists)
        const nowPlayingValue = event === "started"
          ? `${rom.title} (${rom.system})`
          : "";
        await fetch(`${settings.haBaseUrl}/api/states/input_text.homearcade_now_playing`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.haToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: nowPlayingValue }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => {}); // ignore if helper doesn't exist
      } catch {
        // HA event failure is non-fatal
      }
    }

    res.json({ ok: true });
  });

  // Recent play session history
  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.listRecentSessions(100);
      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  // Current "now playing" state — polled by the Lovelace card and HA REST sensor
  app.get("/api/now-playing", (_req, res) => {
    if (nowPlayingRom) {
      res.json({ playing: true, ...nowPlayingRom });
    } else {
      res.json({ playing: false });
    }
  });

  app.get("/api/current-user", (req, res) => {
    const { userId, userName } = getUserFromRequest(req);
    res.json({ userId, userName });
  });

  // ── Save-state server backups ──────────────────────────────────────────────
  app.get("/api/roms/:id/save-backups", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const dir = path.join(SAVE_BACKUP_DIR, userId, String(id));
    try {
      const files = await fs.readdir(dir);
      const slots = files
        .map((f) => { const m = f.match(/^slot-(\d+)\.state$/); return m ? Number(m[1]) : null; })
        .filter((s): s is number => s !== null)
        .sort((a, b) => a - b);
      res.json({ slots });
    } catch {
      res.json({ slots: [] });
    }
  });

  app.get("/api/roms/:id/save-backup/:slot", async (req, res) => {
    const id = Number(req.params.id);
    const slot = Number(req.params.slot);
    if (!Number.isFinite(slot) || slot < 1 || slot > 99) return res.status(400).json({ message: "Invalid slot." });
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const filePath = path.join(SAVE_BACKUP_DIR, userId, String(id), `slot-${slot}.state`);
    try {
      const buf = await fs.readFile(filePath);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="slot-${slot}.state"`);
      res.send(buf);
    } catch {
      res.status(404).json({ message: "No backup for this slot." });
    }
  });

  app.put("/api/roms/:id/save-backup/:slot", async (req, res) => {
    const id = Number(req.params.id);
    const slot = Number(req.params.slot);
    if (!Number.isFinite(slot) || slot < 1 || slot > 99) return res.status(400).json({ message: "Invalid slot." });
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const dir = path.join(SAVE_BACKUP_DIR, userId, String(id));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `slot-${slot}.state`);
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const buf = Buffer.concat(chunks);
      if (buf.length > 64 * 1024 * 1024) {
        return res.status(413).json({ message: "Backup too large (64 MB max)." });
      }
      await fs.writeFile(filePath, buf);
      res.json({ ok: true, slot, size: buf.length });
    });
    req.on("error", () => res.status(500).json({ message: "Upload error." }));
  });

  app.delete("/api/roms/:id/save-backup/:slot", async (req, res) => {
    const id = Number(req.params.id);
    const slot = Number(req.params.slot);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const filePath = path.join(SAVE_BACKUP_DIR, userId, String(id), `slot-${slot}.state`);
    try { await fs.unlink(filePath); } catch { /* not found is fine */ }
    res.json({ ok: true });
  });

  app.get("/api/roms/:id/save-thumb/:slot", async (req, res) => {
    const id = Number(req.params.id);
    const slot = req.params.slot; // can be "auto" or a number
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const filePath = path.join(SAVE_BACKUP_DIR, userId, String(id), `slot-${slot}.jpg`);
    try {
      await fs.access(filePath);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.sendFile(path.resolve(filePath));
    } catch {
      res.status(404).json({ message: "No thumbnail for this slot." });
    }
  });

  app.put("/api/roms/:id/save-thumb/:slot", express.json({ limit: "2mb" }), async (req, res) => {
    const id = Number(req.params.id);
    const slot = req.params.slot;
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const { userId } = getUserFromRequest(req);
    const { dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith("data:image/jpeg;base64,")) {
      return res.status(400).json({ message: "Invalid dataUrl." });
    }
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    const dir = path.join(SAVE_BACKUP_DIR, userId, String(id));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `slot-${slot}.jpg`);
    await fs.writeFile(filePath, base64Data, "base64");
    res.json({ ok: true });
  });

  // ── EmulationStation XML import ─────────────────────────────────────────────
  app.post("/api/import/emulationstation", express.raw({ limit: "50mb", type: ["text/xml", "application/xml", "application/octet-stream", "text/plain"] }), async (req, res) => {
    try {
      const xml = req.body.toString("utf8");
      // Parse <game> blocks with simple regex (gamelist.xml is predictable)
      const gameBlocks = [...xml.matchAll(/<game[^>]*>([\s\S]*?)<\/game>/gi)];
      const roms = await storage.listUploadedRoms();
      const results: { title: string; updated: boolean; reason?: string }[] = [];

      for (const block of gameBlocks) {
        const inner = block[1];
        const get = (tag: string) => {
          const m = inner.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i"));
          return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : null;
        };
        const path2 = get("path");
        const name = get("name");
        if (!path2 && !name) continue;

        const baseName = path2 ? path2.split(/[\/]/).pop()?.replace(/\..*$/, "").toLowerCase() : null;
        const match = roms.find((r) => {
          if (baseName && r.originalName.replace(/\..*$/, "").toLowerCase() === baseName) return true;
          if (name && r.title.toLowerCase() === (name ?? "").toLowerCase()) return true;
          return false;
        });

        if (!match) {
          results.push({ title: name ?? path2 ?? "?", updated: false, reason: "no matching ROM" });
          continue;
        }

        const descRaw = get("desc");
        const dateRaw = get("releasedate");
        const devRaw = get("developer");
        const pubRaw = get("publisher");
        const genreRaw = get("genre");
        const playersRaw = get("players");
        const imageRaw = get("image");

        const meta: Record<string, unknown> = {};
        if (descRaw) meta.description = descRaw.slice(0, 2000);
        if (dateRaw) { const y = Number(dateRaw.slice(0, 4)); if (y >= 1970 && y <= 2030) meta.releaseYear = y; }
        if (devRaw) meta.developer = devRaw.slice(0, 256);
        if (pubRaw) meta.publisher = pubRaw.slice(0, 256);
        if (genreRaw) meta.genre = genreRaw.slice(0, 256);
        if (playersRaw) meta.players = playersRaw.slice(0, 16);
        if (imageRaw && imageRaw.startsWith("http")) meta.artUrl = imageRaw;
        if (Object.keys(meta).length > 0) {
          if (meta.artUrl || meta.description || meta.developer || meta.publisher || meta.genre) {
            meta.scrapeStatus = "matched";
          }
          await storage.updateUploadedRomMetadata(match.id, meta as Parameters<typeof storage.updateUploadedRomMetadata>[1]);
        }
        results.push({ title: match.title, updated: true });
      }
      res.json({ imported: results.filter((r) => r.updated).length, skipped: results.filter((r) => !r.updated).length, results });
    } catch (err) {
      res.status(400).json({ message: String(err) });
    }
  });

  // ── LaunchBox XML import ───────────────────────────────────────────────────
  app.post("/api/import/launchbox", express.raw({ limit: "50mb", type: ["text/xml", "application/xml", "application/octet-stream", "text/plain"] }), async (req, res) => {
    try {
      const xml = req.body.toString("utf8");
      // LaunchBox uses <Game> elements (not wrapped in <game>)
      const gameBlocks = [...xml.matchAll(/<Game>([\s\S]*?)<\/Game>/gi)];
      const roms = await storage.listUploadedRoms();
      const results: { title: string; updated: boolean; reason?: string }[] = [];

      for (const block of gameBlocks) {
        const inner = block[1];
        const get = (tag: string) => {
          const m = inner.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, "i"));
          return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : null;
        };

        const title = get("Title");
        const appPath = get("ApplicationPath");
        if (!title && !appPath) continue;

        const baseName = appPath ? appPath.split(/[\/]/).pop()?.replace(/\..*$/, "").toLowerCase() : null;
        const match = roms.find((r) => {
          if (baseName && r.originalName.replace(/\..*$/, "").toLowerCase() === baseName) return true;
          if (title && r.title.toLowerCase() === (title ?? "").toLowerCase()) return true;
          return false;
        });

        if (!match) {
          results.push({ title: title ?? appPath ?? "?", updated: false, reason: "no matching ROM" });
          continue;
        }

        const meta: Record<string, unknown> = {};
        const overview = get("Notes") ?? get("Overview");
        const releaseDate = get("ReleaseDate");
        const developer = get("Developer");
        const publisher = get("Publisher");
        const genre = get("Genre") ?? get("Genres");
        const maxPlayers = get("MaxPlayers");

        if (overview) meta.description = overview.slice(0, 2000);
        if (releaseDate) {
          const y = Number(releaseDate.slice(0, 4));
          if (y >= 1970 && y <= 2030) meta.releaseYear = y;
        }
        if (developer) meta.developer = developer.slice(0, 256);
        if (publisher) meta.publisher = publisher.slice(0, 256);
        if (genre) meta.genre = genre.split(";")[0].trim().slice(0, 256);
        if (maxPlayers) meta.players = maxPlayers.trim().slice(0, 16);

        if (Object.keys(meta).length > 0) {
          if (meta.description || meta.developer || meta.publisher || meta.genre) {
            meta.scrapeStatus = "matched";
          }
          await storage.updateUploadedRomMetadata(match.id, meta as Parameters<typeof storage.updateUploadedRomMetadata>[1]);
        }
        results.push({ title: match.title, updated: true });
      }
      res.json({ imported: results.filter((r) => r.updated).length, skipped: results.filter((r) => !r.updated).length, results });
    } catch (err) {
      res.status(400).json({ message: String(err) });
    }
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
  dreamcast: 23,
  gb: 9,
  gbc: 10,
  nds: 15,
  psp: 61,
  atari2600: 26,
  saturn: 22,
  gamegear: 21,
  sms: 2,
  pce: 31,
  sega32x: 19,
  segacd: 20,
  neogeo: 142,
  virtualboy: 11,
  atari7800: 41,
  lynx: 28,
};

interface ScreenScraperMeta {
  artUrl: string | null;
  wheelArtUrl: string | null;
  videoUrl: string | null;
  communityScore: number | null;
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
    let wheelArtUrl: string | null = null;
    let videoUrl: string | null = null;
    const medias = jeu.medias as Array<{ type: string; region?: string; url?: string }> | undefined;
    if (Array.isArray(medias)) {
      const boxTypes = ["box-2D", "box-2D-side", "mixrbv1"];
      for (const boxType of boxTypes) {
        const candidates = medias.filter((m) => m.type === boxType);
        const best = candidates.find((m) => ["us", "wor", "eu"].includes(m.region ?? "")) ?? candidates[0];
        if (best?.url) { artUrl = best.url; break; }
      }
      // Wheel art (logo PNG with transparent background)
      const wheelTypes = ["wheel-hd", "wheel", "wheel-carbon"];
      for (const wt of wheelTypes) {
        const w = medias.find((m) => m.type === wt);
        if (w?.url) { wheelArtUrl = w.url; break; }
      }
      // Video preview clip
      const videoTypes = ["video-normalized", "video"];
      for (const vt of videoTypes) {
        const v = medias.find((m) => m.type === vt);
        if (v?.url) { videoUrl = v.url; break; }
      }
    }

    // Community score: ScreenScraper returns note on a /20 scale
    let communityScore: number | null = null;
    const noteRaw = (jeu.note as { text?: string } | undefined)?.text;
    if (noteRaw) {
      const parsed = parseFloat(noteRaw);
      if (!isNaN(parsed)) communityScore = parsed;
    }

    return {
      artUrl,
      wheelArtUrl,
      videoUrl,
      communityScore,
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
    // Strip No-Intro / TOSEC region tags e.g. (U), (USA), (E), (Europe), (J), (Japan), (Germany), (Fr), etc.
    .replace(/\s*\([A-Z][a-zA-Z,\s]*\)/g, "")
    // Strip No-Intro verification flags e.g. [!], [a], [b], [t], [o], [f], [h], [T+...], [b2]
    .replace(/\s*\[[^\]]*\]/g, "")
    // Strip revision / version tags e.g. (Rev 1), (Rev A), (v1.1), (Beta), (Proto), (Demo)
    .replace(/\s*\((Rev|v|Beta|Proto|Demo|Sample|Hack|Alt|Unl)[^)]*\)/gi, "")
    // Strip disc/disk tags e.g. (Disc 1), (Disk A)
    .replace(/\s*\(Dis[ck][^)]*\)/gi, "")
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

function renderEmulatorPage({ title, returnTo, romHash }: { title: string; returnTo: string; romHash: string | null }) {
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
        max-height: min(82vh, calc(100dvh - 90px));
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
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
        overscroll-behavior: contain;
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
      .cabinet-menu-hash {
        margin: 4px 0 0;
        color: rgba(248, 250, 252, 0.28);
        font: 600 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.06em;
        cursor: pointer;
        user-select: all;
      }
      .cabinet-menu-hash:hover { color: rgba(248, 250, 252, 0.55); }
      .cabinet-menu-divider {
        grid-column: 1 / -1;
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
      .cabinet-user-badge {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,.75);
        background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 20px;
        padding: 3px 10px;
        white-space: nowrap;
        align-self: flex-start;
        margin-top: 4px;
        letter-spacing: .3px;
        flex-shrink: 0;
      }
      .cabinet-menu-panel__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .cabinet-menu-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 8px 18px 24px;
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
      .cabinet-opt {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: rgba(255,255,255,0.07);
        color: rgba(248,250,252,0.8);
        cursor: pointer;
        font: 800 9px ui-monospace,monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .cabinet-opt:hover,
      .cabinet-opt:focus-visible {
        background: rgba(236,72,153,0.2);
        border-color: rgba(236,72,153,0.55);
        color: #fff;
        outline: none;
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
      /* Filters — !important overrides EmulatorJS inline canvas styles */
      #game.cabinet-filter-crt canvas {
        filter: contrast(1.15) brightness(0.92) saturate(1.2) !important;
      }
      #game.cabinet-filter-smooth canvas {
        image-rendering: auto !important;
        filter: blur(0.5px) brightness(1.02) !important;
      }
      /* Aspect ratio — !important overrides EmulatorJS inline width/height */
      #game.cabinet-aspect-4-3,
      #game.cabinet-aspect-16-9,
      #game.cabinet-aspect-pixel,
      #game.cabinet-aspect-stretch {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden;
      }
      #game.cabinet-aspect-4-3 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 4/3 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-16-9 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 16/9 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-pixel canvas {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        image-rendering: pixelated !important;
        aspect-ratio: unset !important;
      }
      #game.cabinet-aspect-stretch canvas {
        width: 100% !important;
        height: 100% !important;
        aspect-ratio: unset !important;
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
      /* Filters — !important overrides EmulatorJS inline canvas styles */
      #game.cabinet-filter-crt canvas {
        filter: contrast(1.15) brightness(0.92) saturate(1.2) !important;
      }
      #game.cabinet-filter-smooth canvas {
        image-rendering: auto !important;
        filter: blur(0.5px) brightness(1.02) !important;
      }
      /* Aspect ratio — !important overrides EmulatorJS inline width/height */
      #game.cabinet-aspect-4-3,
      #game.cabinet-aspect-16-9,
      #game.cabinet-aspect-pixel,
      #game.cabinet-aspect-stretch {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden;
      }
      #game.cabinet-aspect-4-3 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 4/3 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-16-9 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 16/9 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-pixel canvas {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        image-rendering: pixelated !important;
        aspect-ratio: unset !important;
      }
      #game.cabinet-aspect-stretch canvas {
        width: 100% !important;
        height: 100% !important;
        aspect-ratio: unset !important;
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
          <p class="cabinet-menu-title">${safeTitle}</p>
          <p class="cabinet-menu-subtitle">Save · Load · Controls · Exit</p>
          ${romHash ? `<p class="cabinet-menu-hash" title="MD5: ${romHash}" id="cabinet-rom-hash" data-hash="${romHash}">MD5 ···${romHash.slice(-8)}</p>` : ""}
        </div>
        <span class="cabinet-user-badge" id="cabinet-user-badge" title="Saves are stored per user" hidden></span>
      </div>
      <div class="cabinet-menu-grid">
        <button type="button" class="primary-action" id="cabinet-resume" data-testid="button-resume-game">Resume Game</button>
        <button type="button" id="cabinet-save" data-testid="button-quick-save">Quick Save</button>
        <button type="button" id="cabinet-load" data-testid="button-quick-load">Quick Load</button>
        <button type="button" id="cabinet-save-manager-open" data-testid="button-open-save-manager">Save Slots</button>
        <button type="button" id="cabinet-pad-toggle" aria-pressed="false" data-testid="button-toggle-gamepad">Show Pad</button>
        <button type="button" id="cabinet-controls" data-testid="button-show-controls">Controls</button>
        <button type="button" id="cabinet-rewind-toggle" aria-pressed="false" data-testid="button-toggle-rewind">Rewind</button>
        <button type="button" id="cabinet-ff-toggle" aria-pressed="false" data-testid="button-toggle-fastforward">Fast-Fwd</button>
        <button type="button" id="cabinet-cheats" data-testid="button-cheats">Cheats</button>
        <button type="button" id="cabinet-screenshot" data-testid="button-screenshot">Screenshot</button>
        <button type="button" id="cabinet-display-open" data-testid="button-display-settings">Display</button>
        <button type="button" id="cabinet-remap-open" data-testid="button-remap-controls">Remap Keys</button>
        <button type="button" id="cabinet-gamepad-test-open" data-testid="button-gamepad-tester">Test Pad</button>
        <button type="button" id="cabinet-netplay-open" data-testid="button-netplay">Netplay</button>
        <button type="button" id="cabinet-sleep-open" data-testid="button-sleep-timer">Sleep Timer</button>
        <button type="button" id="cabinet-crt-toggle" aria-pressed="false" data-testid="button-crt-filter">CRT Filter</button>
        <div class="cabinet-menu-divider" role="separator"></div>
        <button type="button" class="danger" id="cabinet-exit" data-testid="button-exit-player">Exit Game</button>
      </div>
    </nav>
    <section class="cabinet-save-panel" id="cabinet-save-panel" aria-label="Save state manager" aria-hidden="true" data-testid="panel-save-manager">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Save-state Manager</p>
          <p class="cabinet-save-subtitle">Nine browser-local slots for this game · saved as <strong id="cabinet-save-user"></strong></p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-save-manager-close" aria-label="Close save-state manager" data-testid="button-close-save-manager">×</button>
      </div>
      <div class="cabinet-save-grid" id="cabinet-save-grid" data-testid="grid-save-slots"></div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-controls-panel" aria-label="Controls reference" aria-hidden="true" data-testid="panel-controls">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Controls</p>
          <p class="cabinet-save-subtitle" id="cabinet-controls-subtitle">Keyboard &amp; gamepad layout</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-controls-close" aria-label="Close controls" data-testid="button-close-controls">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:14px;" id="cabinet-controls-body">
        <!-- populated by cabinetRenderControls() -->
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-sleep-panel" aria-label="Sleep timer" aria-hidden="true" data-testid="panel-sleep-timer">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Sleep Timer</p>
          <p class="cabinet-save-subtitle">Auto-saves and exits after the chosen time</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-sleep-close" aria-label="Close sleep timer" data-testid="button-close-sleep-timer">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:16px;">
        <div id="cabinet-sleep-picker" style="display:flex;flex-direction:column;gap:10px;">
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;">Duration</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="cabinet-sleep-group" role="radiogroup" aria-label="Sleep duration">
            <button type="button" class="cabinet-opt" data-sleep-mins="15" data-testid="button-sleep-15">15 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="30" data-testid="button-sleep-30">30 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="45" data-testid="button-sleep-45">45 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="60" data-testid="button-sleep-60">60 min</button>
          </div>
          <button type="button" id="cabinet-sleep-start" data-testid="button-start-sleep-timer"
            style="margin-top:4px;padding:9px 16px;border-radius:8px;font:700 12px ui-monospace,monospace;letter-spacing:0.08em;background:hsl(322 92% 60%);color:#fff;border:none;cursor:pointer;opacity:0.5;pointer-events:none;"
            disabled>Start Timer</button>
        </div>
        <div id="cabinet-sleep-running" style="display:none;flex-direction:column;align-items:center;gap:12px;text-align:center;">
          <div style="font:700 13px ui-monospace,monospace;color:rgba(248,250,252,0.56);letter-spacing:0.12em;text-transform:uppercase;">Time Remaining</div>
          <div id="cabinet-sleep-countdown" style="font:800 48px ui-monospace,monospace;color:#fff;letter-spacing:-0.02em;">--:--</div>
          <button type="button" id="cabinet-sleep-cancel" data-testid="button-cancel-sleep-timer"
            style="padding:9px 20px;border-radius:8px;font:700 12px ui-monospace,monospace;letter-spacing:0.08em;background:transparent;color:rgba(248,250,252,0.7);border:1px solid rgba(248,250,252,0.2);cursor:pointer;">Cancel Timer</button>
        </div>
      </div>
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
      <div style="padding:8px 18px 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <select id="cabinet-remap-profile-select" style="flex:1;min-width:90px;background:#1a1a2e;border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:600 10px ui-monospace,monospace;padding:6px 8px;cursor:pointer;" aria-label="Select remap profile"></select>
        <button type="button" id="cabinet-remap-profile-load" style="appearance:none;border:1px solid rgba(248,250,252,0.2);border-radius:8px;background:rgba(248,250,252,0.08);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Load</button>
        <button type="button" id="cabinet-remap-profile-save" style="appearance:none;border:1px solid rgba(99,179,100,0.4);border-radius:8px;background:rgba(99,179,100,0.12);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Save As…</button>
        <button type="button" id="cabinet-remap-profile-delete" style="appearance:none;border:1px solid rgba(239,68,68,0.3);border-radius:8px;background:rgba(239,68,68,0.08);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Del</button>
      </div>
      <div id="cabinet-remap-grid" style="padding:14px 18px 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;max-height:calc(min(86vh,720px)-130px);"></div>
      <div style="padding:0 18px 14px;display:flex;gap:8px;">
        <button type="button" id="cabinet-remap-reset" style="appearance:none;border:1px solid rgba(239,68,68,0.5);border-radius:12px;background:rgba(239,68,68,0.12);color:#f8fafc;cursor:pointer;font:800 9px ui-monospace,monospace;letter-spacing:0.12em;padding:10px 16px;text-transform:uppercase;">Reset to Defaults</button>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-gamepad-panel" aria-label="Gamepad tester" aria-hidden="true" data-testid="panel-gamepad-tester">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Gamepad Tester</p>
          <p class="cabinet-save-subtitle">Connect a controller and press any button to detect it.</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-gamepad-panel-close" aria-label="Close gamepad tester" data-testid="button-close-gamepad-tester">×</button>
      </div>
      <div id="cabinet-gamepad-tester-body" style="padding:14px 18px 18px;overflow-y:auto;max-height:calc(min(86vh,720px)-94px);">
        <p id="cabinet-gp-status" style="font:600 11px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.08em;margin:0 0 12px;">No controller detected yet. Press any button on your gamepad.</p>
        <div id="cabinet-gp-list" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-netplay-panel" aria-label="Netplay" aria-hidden="true" data-testid="panel-netplay">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Netplay</p>
          <p class="cabinet-save-subtitle">Play with a friend over the network</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-netplay-close" aria-label="Close netplay" data-testid="button-close-netplay">×</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" id="cabinet-netplay-host" style="appearance:none;border:1px solid rgba(99,179,237,0.4);border-radius:12px;background:rgba(99,179,237,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:14px 10px;text-transform:uppercase;" data-testid="button-netplay-host">Host Game</button>
          <button type="button" id="cabinet-netplay-join" style="appearance:none;border:1px solid rgba(34,197,94,0.4);border-radius:12px;background:rgba(34,197,94,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:14px 10px;text-transform:uppercase;" data-testid="button-netplay-join">Join Game</button>
        </div>
        <div id="cabinet-netplay-host-section" style="display:none;flex-direction:column;gap:8px;">
          <div style="font:600 10px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.1em;text-transform:uppercase;">Your Room Code</div>
          <div id="cabinet-netplay-room-code" style="font:800 28px ui-monospace,monospace;color:#f8fafc;letter-spacing:0.3em;text-align:center;padding:14px;background:rgba(248,250,252,0.05);border-radius:10px;border:1px solid rgba(248,250,252,0.1);cursor:pointer;user-select:all;" title="Click to copy" data-testid="text-netplay-room-code">—</div>
          <div style="font:11px ui-monospace,monospace;color:rgba(248,250,252,0.4);text-align:center;">Share this code with your opponent</div>
        </div>
        <div id="cabinet-netplay-join-section" style="display:none;flex-direction:column;gap:8px;">
          <div style="font:600 10px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.1em;text-transform:uppercase;">Enter Room Code</div>
          <div style="display:flex;gap:8px;">
            <input id="cabinet-netplay-code-input" type="text" maxlength="8" placeholder="XXXXXXXX" style="flex:1;background:rgba(248,250,252,0.06);border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:700 18px ui-monospace,monospace;letter-spacing:0.25em;padding:10px 12px;text-transform:uppercase;outline:none;" data-testid="input-netplay-code" />
            <button type="button" id="cabinet-netplay-connect" style="appearance:none;border:1px solid rgba(34,197,94,0.4);border-radius:8px;background:rgba(34,197,94,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:10px 16px;text-transform:uppercase;" data-testid="button-netplay-connect">Connect</button>
          </div>
        </div>
        <div id="cabinet-netplay-status" style="font:600 11px ui-monospace,monospace;color:rgba(248,250,252,0.4);min-height:16px;" data-testid="text-netplay-status"></div>
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
      console.log("[HomeArcade] player HTML inline script ran, loading bootstrap.js");
    </script>
    <script src="./bootstrap.js" onerror="(function(){var p=document.querySelector('#cabinet-progress-percent');var s=document.querySelector('#cabinet-progress-stage');if(p)p.textContent='ERR';if(s)s.textContent='bootstrap.js blocked';console.error('[HomeArcade] bootstrap.js FAILED to load');})()"></script>
  </body>
</html>`;
}


// ── EJS default controls builder ───────────────────────────────────────────
const EJS_DEFAULT_KEYS: Record<number, string> = {
  0: "z", 1: "a", 2: "shift", 3: "enter",
  4: "up arrow", 5: "down arrow", 6: "left arrow", 7: "right arrow",
  8: "x", 9: "s", 10: "q", 11: "w",
  12: "e", 13: "r", 14: "tab", 15: "c",
  24: "1", 25: "2", 26: "3",
};
const EJS_VALUE2: Record<number, string> = {
  0: "BUTTON_1", 1: "BUTTON_4", 2: "SELECT", 3: "START",
  4: "DPAD_UP", 5: "DPAD_DOWN", 6: "DPAD_LEFT", 7: "DPAD_RIGHT",
  8: "BUTTON_2", 9: "BUTTON_3", 10: "LEFT_TOP_SHOULDER", 11: "RIGHT_TOP_SHOULDER",
  12: "LEFT_BOTTOM_SHOULDER", 13: "RIGHT_BOTTOM_SHOULDER",
  14: "LEFT_ANALOG", 15: "RIGHT_ANALOG",
};

function buildEjsControls(
  core: string,
  controlDefaults: Record<string, Record<number, string>>,
): Record<number, Record<number, { value: string; value2?: string }>> {
  const isPS = ["psx", "pcsx2", "ppsspp"].includes(core);
  const maxBtn = isPS ? 15 : 11;
  const custom: Record<number, string> = {};
  // Merge numeric keys from saved config (keys may be strings after JSON round-trip)
  for (const [k, v] of Object.entries(controlDefaults[core] ?? {})) {
    custom[Number(k)] = v;
  }
  const p1: Record<number, { value: string; value2?: string }> = {};
  for (let i = 0; i <= maxBtn; i++) {
    const key = custom[i] ?? EJS_DEFAULT_KEYS[i];
    if (!key) continue;
    const entry: { value: string; value2?: string } = { value: key };
    if (EJS_VALUE2[i]) entry.value2 = EJS_VALUE2[i];
    p1[i] = entry;
  }
  // Hotkeys (shared, still respect custom overrides)
  for (const idx of [24, 25, 26]) {
    p1[idx] = { value: custom[idx] ?? EJS_DEFAULT_KEYS[idx] ?? String(idx - 23) };
  }
  return { 0: p1, 1: {}, 2: {}, 3: {} };
}

function renderEmulatorBootstrap({ core, title, gameId, romId, discs, romHash, raUsername, raToken, controlDefaults, userId, userName }: { core: string; title: string; gameId: string; romId: number; discs: Array<{ id: number; label: string }>; romHash: string | null; raUsername: string; raToken: string; controlDefaults: Record<string, Record<number, string>>; userId: string; userName: string; }) {
  return `"use strict";
// Diagnostic: immediately mark that this script is executing.
// If the launch overlay stays at 0%, this script never ran.
(function () {
  var pct = document.querySelector("#cabinet-progress-percent");
  var stage = document.querySelector("#cabinet-progress-stage");
  var overlay = document.querySelector("#cabinet-launch-overlay");
  if (pct) pct.textContent = "2%";
  if (stage) stage.textContent = "Bootstrap";
  if (overlay) overlay.classList.remove("is-hidden");
  console.log("[HomeArcade] bootstrap.js executing for ROM ${romId} core=${core}");
})();
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
var cabinetRomHash = ${JSON.stringify(romHash || "")};
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
async function cabinetCaptureThumb(slot) {
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
    
    // Upload to server
    await fetch("./save-thumb/" + slot, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: dataUrl })
    }).catch(function() {});
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
function cabinetGetThumbUrl(slot) {
  var local = cabinetGetThumb(slot);
  if (local) return local;
  return "./save-thumb/" + slot + "?t=" + Date.now();
}
function cabinetRenderSaveSlots() {
  var grid = document.querySelector("#cabinet-save-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (var slot = 1; slot <= 9; slot += 1) {
    var state = cabinetGetSaveSlot(slot);
    var hasBackup = cabinetServerBackups.indexOf(slot) !== -1;
    var card = document.createElement("article");
    card.className = "cabinet-save-slot";
    card.setAttribute("data-filled", state ? "true" : "false");
    card.setAttribute("data-testid", "card-save-slot-" + slot);
    
    var thumbUrl = (state || hasBackup) ? cabinetGetThumbUrl(slot) : null;
    var thumbHtml = thumbUrl
      ? '<div class="cabinet-save-slot__thumb"><img src="' + thumbUrl + '" alt="Save slot ' + slot + ' preview" loading="lazy"></div>'
      : '<div class="cabinet-save-slot__thumb cabinet-save-slot__thumb--empty"></div>';
    
    var cloudBadge = hasBackup ? ' <span title="Server backup exists" style="font-size:10px;">&#9729;</span>' : "";
    card.innerHTML =
      thumbHtml +
      '<div class="cabinet-save-slot__eyebrow">Slot ' + slot + cloudBadge + '</div>' +
      '<div class="cabinet-save-slot__label">' + (state ? cabinetEscapeText(state.label || ("Slot " + slot)) : "Empty") + '</div>' +
      '<div class="cabinet-save-slot__meta">' + (state ? cabinetRelativeTime(state.updatedAt) : (hasBackup ? "No local save \u2014 server backup available" : "No save data yet")) + '</div>' +
      '<div class="cabinet-save-slot__actions">' +
      '<button type="button" data-save-action="save" data-slot="' + slot + '" data-testid="button-save-slot-' + slot + '">Save</button>' +
      '<button type="button" data-save-action="load" data-slot="' + slot + '" data-testid="button-load-slot-' + slot + '"' + (state ? "" : " disabled") + ">Load</button>" +
      '<button type="button" data-save-action="backup" data-slot="' + slot + '" data-testid="button-backup-slot-' + slot + '"' + (state ? "" : " disabled") + ' title="Back up to server" style="background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.4);">&#9729; Backup</button>' +
      '<button type="button" data-save-action="restore" data-slot="' + slot + '" data-testid="button-restore-slot-' + slot + '"' + (hasBackup ? "" : " disabled") + ' title="Restore from server" style="background:rgba(34,197,94,0.18);border-color:rgba(34,197,94,0.4);">&#8635; Restore</button>' +
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
function cabinetSetPanelOpen(panelId, open) {
  var panel = document.querySelector("#" + panelId);
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) { cabinetSetMenuOpen(false); }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
}

var cabinetSleepSelectedMins = 0;
var cabinetSleepTimerId = null;
var cabinetSleepEndTime = 0;
var cabinetSleepTickId = null;

function cabinetSelectSleepDuration(mins) {
  cabinetSleepSelectedMins = mins;
  var btns = document.querySelectorAll("[data-sleep-mins]");
  btns.forEach(function(b) {
    var active = Number(b.getAttribute("data-sleep-mins")) === mins;
    b.style.background = active ? "hsl(322 92% 60%)" : "rgba(255,255,255,0.07)";
    b.style.color = active ? "#fff" : "rgba(248,250,252,0.8)";
    b.style.border = active ? "none" : "1px solid rgba(255,255,255,0.12)";
  });
  var startBtn = document.querySelector("#cabinet-sleep-start");
  if (startBtn) {
    startBtn.removeAttribute("disabled");
    startBtn.style.opacity = "1";
    startBtn.style.pointerEvents = "auto";
  }
}

function cabinetUpdateSleepCountdown() {
  var remaining = Math.max(0, cabinetSleepEndTime - Date.now());
  var totalSecs = Math.ceil(remaining / 1000);
  var mins = Math.floor(totalSecs / 60);
  var secs = totalSecs % 60;
  var el = document.querySelector("#cabinet-sleep-countdown");
  if (el) {
    el.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }
  if (remaining <= 0) {
    clearInterval(cabinetSleepTickId);
    cabinetSleepTickId = null;
    cabinetSleepFire();
  }
}

function cabinetSleepFire() {
  cabinetToast("Sleep timer: auto-saving and exiting…");
  var returnTo = window.CABINET_RETURN_TO || "";
  var duration = cabinetSessionStart ? Math.round((Date.now() - cabinetSessionStart) / 1000) : 0;
  var doExit = function() {
    fetch("./play-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "ended", durationSeconds: duration }),
    }).catch(function(){}).finally(function() {
      if (returnTo) { window.location.href = returnTo; return; }
      if (window.opener) { window.close(); return; }
      window.location.href = "/";
    });
  };
  if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
    try { window.EJS_emulator.saveState(0); } catch(e) {}
    setTimeout(doExit, 800);
  } else {
    doExit();
  }
}

function cabinetStartSleepTimer() {
  if (!cabinetSleepSelectedMins) return;
  cabinetSleepEndTime = Date.now() + cabinetSleepSelectedMins * 60 * 1000;
  // Switch UI to running state
  var picker = document.querySelector("#cabinet-sleep-picker");
  var running = document.querySelector("#cabinet-sleep-running");
  if (picker) picker.style.display = "none";
  if (running) { running.style.display = "flex"; }
  cabinetUpdateSleepCountdown();
  cabinetSleepTickId = setInterval(cabinetUpdateSleepCountdown, 1000);
  cabinetSetPanelOpen("cabinet-sleep-panel", false);
  cabinetToast("Sleep timer set for " + cabinetSleepSelectedMins + " min");
}

function cabinetCancelSleepTimer() {
  if (cabinetSleepTickId) { clearInterval(cabinetSleepTickId); cabinetSleepTickId = null; }
  cabinetSleepEndTime = 0;
  // Reset picker UI
  var picker = document.querySelector("#cabinet-sleep-picker");
  var running = document.querySelector("#cabinet-sleep-running");
  if (picker) picker.style.display = "flex";
  if (running) running.style.display = "none";
  cabinetSetPanelOpen("cabinet-sleep-panel", false);
  cabinetToast("Sleep timer cancelled");
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
    cabinetFetchServerBackups().then(function() { cabinetFetchSaveSlots(); });
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
  // Automatic sync: capture thumb and backup to server
  cabinetCaptureThumb(slot).then(function() {
    return cabinetBackupSlot(slot);
  }).catch(function() {});

  cabinetRecordSaveSlot(slot)
    .then(function () {
      cabinetToast("Saved state to slot " + slot + " \u2601");
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
    toggle.textContent = visible ? "Hide Pad" : "Show Pad";
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
    cabinetSetControlsPanel(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cabinetSetMenuOpen(false);
      cabinetSetSaveManagerOpen(false);
      cabinetSetControlsPanel(false);
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
    // Auto-save to slot 0 before exiting so progress is never lost
    var doPostAndExit = function () {
      fetch("./play-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "ended", durationSeconds: duration }),
      }).catch(function () {}).finally(doExit);
    };
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      cabinetToast("Auto-saving…");
      try {
        window.EJS_emulator.saveState(0);
        // Give the emulator a moment to write the state, then exit
        setTimeout(doPostAndExit, 800);
      } catch (e) {
        doPostAndExit();
      }
    } else {
      doPostAndExit();
    }
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
  if (target.id === "cabinet-sleep-open") {
    cabinetSetMenuOpen(false);
    cabinetSetPanelOpen("cabinet-sleep-panel", true);
  }
  if (target.id === "cabinet-sleep-close") {
    cabinetSetPanelOpen("cabinet-sleep-panel", false);
  }
  if (target.id === "cabinet-sleep-cancel") {
    cabinetCancelSleepTimer();
  }
  if (target.id === "cabinet-sleep-start") {
    cabinetStartSleepTimer();
  }
  var sleepMins = target.getAttribute("data-sleep-mins");
  if (sleepMins) {
    cabinetSelectSleepDuration(Number(sleepMins));
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
      if (saveAction === "backup") {
        cabinetBackupSlot(slot);
      }
      if (saveAction === "restore") {
        cabinetRestoreSlot(slot);
      }
    }
  }
  if (target.id === "cabinet-pad-toggle") {
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-controls") {
    cabinetSetMenuOpen(false);
    cabinetSetControlsPanel(true);
  }
  if (target.id === "cabinet-controls-close") {
    cabinetSetControlsPanel(false);
  }
  // rewind is hold-to-rewind — handled via mousedown/up events, not click
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
  if (target.id === "cabinet-crt-toggle") {
    var _game = document.querySelector("#game");
    var _crtOn = _game && _game.classList.contains("cabinet-filter-crt");
    cabinetApplyFilter(_crtOn ? "none" : "crt");
    var _crtBtn = document.querySelector("#cabinet-crt-toggle");
    if (_crtBtn) { _crtBtn.setAttribute("aria-pressed", _crtOn ? "false" : "true"); _crtBtn.textContent = _crtOn ? "CRT Filter" : "CRT On"; }
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
function cabinetSetControlsPanel(open) {
  var panel = document.querySelector("#cabinet-controls-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) cabinetRenderControls();
}
function cabinetRenderControls() {
  var body = document.querySelector("#cabinet-controls-body");
  var subtitle = document.querySelector("#cabinet-controls-subtitle");
  if (!body) return;
  var isPsx = window.CABINET_CORE === "psx" || window.CABINET_CORE === "pcsx2";
  var isGba = window.CABINET_CORE === "gba";
  var isGb  = window.CABINET_CORE === "gb" || window.CABINET_CORE === "gbc";
  var isN64 = window.CABINET_CORE === "n64";
  var isNds = window.CABINET_CORE === "nds";
  var isPsp = window.CABINET_CORE === "psp";
  // Subtitle
  if (subtitle) {
    var coreLabel = isPsx ? "PlayStation" : isGba ? "Game Boy Advance" : isGb ? "Game Boy / GBC" : isN64 ? "Nintendo 64" : isNds ? "Nintendo DS" : isPsp ? "PSP" : "SNES / NES / Genesis";
    subtitle.textContent = coreLabel + " · keyboard & gamepad";
  }
  var ROW_STYLE = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(248,250,252,0.06);';
  var LABEL_STYLE = 'color:rgba(248,250,252,0.5);font:700 9px ui-monospace,monospace;letter-spacing:0.14em;text-transform:uppercase;';
  var KEY_STYLE = 'color:#f8fafc;font:700 11px ui-monospace,monospace;background:rgba(248,250,252,0.08);border:1px solid rgba(248,250,252,0.18);border-radius:6px;padding:3px 8px;';
  function row(label, key) {
    return '<div style="' + ROW_STYLE + '"><span style="' + LABEL_STYLE + '">' + label + '</span><span style="' + KEY_STYLE + '">' + key + '</span></div>';
  }
  var rows = [];
  var SECTION_STYLE = 'color:rgba(248,250,252,0.35);font:800 8px ui-monospace,monospace;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;';
  function section(label) {
    return '<div style="' + SECTION_STYLE + '">' + label + '</div>';
  }
  if (isPsx) {
    rows.push(section("Face Buttons"));
    rows.push(row("Cross", "Z"));
    rows.push(row("Circle", "X"));
    rows.push(row("Square", "A"));
    rows.push(row("Triangle", "S"));
    rows.push(section("Shoulders"));
    rows.push(row("L1 / R1", "Q / W"));
    rows.push(row("L2 / R2", "E / R"));
    rows.push(row("L3 / R3", "Tab / C"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGba) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGb) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isN64) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("C-Up/Down/Left/Right", "I / K / J / L"));
    rows.push(row("L / R / Z", "Q / W / E"));
    rows.push(section("System"));
    rows.push(row("Start", "Enter"));
    rows.push(row("Analog Stick", "Arrow Keys"));
  } else if (isNds) {
    rows.push(section("Buttons"));
    rows.push(row("A / B / X / Y", "Z / X / A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isPsp) {
    rows.push(section("Buttons"));
    rows.push(row("Cross / Circle", "Z / X"));
    rows.push(row("Square / Triangle", "A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("Analog / D-Pad", "Arrow Keys"));
  } else {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("X / Y", "A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  }
  rows.push(section("Emulator"));
  rows.push(row("Quick Save / Load", "1 / 2"));
  rows.push(row("Rewind", "Backspace"));
  body.innerHTML = rows.join("");
}
function cabinetStartRewind() {
  var btn = document.querySelector("#cabinet-rewind-toggle");
  if (btn) btn.setAttribute("aria-pressed", "true");
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  if (M) {
    if (typeof M.setRewind === "function") { try { M.setRewind(1); } catch (_e) {} }
    else if (typeof M._RA_cmd_rewind_flush === "function") { try { M._RA_cmd_rewind_flush(); } catch (_e) {} }
  }
}
function cabinetStopRewind() {
  var btn = document.querySelector("#cabinet-rewind-toggle");
  if (btn) btn.setAttribute("aria-pressed", "false");
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  if (M && typeof M.setRewind === "function") { try { M.setRewind(0); } catch (_e) {} }
}
function cabinetSetFastForward(enabled) {
  var btn = document.querySelector("#cabinet-ff-toggle");
  if (btn) btn.setAttribute("aria-pressed", String(enabled));
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  var ok = false;
  if (M) {
    if (typeof M.setFastForward === "function") {
      try { M.setFastForward(enabled ? 1 : 0); ok = true; } catch (_e) {}
    }
    if (!ok && typeof M._RA_cmd_toggle_fastforward === "function") {
      try { M._RA_cmd_toggle_fastforward(); ok = true; } catch (_e) {}
    }
  }
  if (!ok && emulator && typeof emulator.setFastForward === "function") {
    try { emulator.setFastForward(enabled); ok = true; } catch (_e) {}
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
  // Remove all aspect classes then add the chosen one.
  // CSS uses !important so it wins over EmulatorJS inline canvas styles.
  game.classList.remove("cabinet-aspect-4-3", "cabinet-aspect-16-9", "cabinet-aspect-pixel", "cabinet-aspect-stretch");
  var cls = { "4:3": "cabinet-aspect-4-3", "16:9": "cabinet-aspect-16-9", "pixel": "cabinet-aspect-pixel", "stretch": "cabinet-aspect-stretch" }[aspect];
  if (cls) game.classList.add(cls);
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
      // Sync the CRT quick-toggle button label
      var _crtBtn = document.querySelector("#cabinet-crt-toggle");
      if (_crtBtn) {
        var _on = filter === "crt";
        _crtBtn.setAttribute("aria-pressed", _on ? "true" : "false");
        _crtBtn.textContent = _on ? "CRT On" : "CRT Filter";
      }
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
// ── Remap profiles ─────────────────────────────────────────────────────────
function cabinetProfilesKey() {
  return "cabinet_remap_profiles_" + (window.EJS_gameID || "game");
}
function cabinetLoadProfiles() {
  try {
    var raw = localStorage.getItem(cabinetProfilesKey());
    return raw ? JSON.parse(raw) : {};
  } catch (_e) { return {}; }
}
function cabinetSaveProfiles(profiles) {
  try { localStorage.setItem(cabinetProfilesKey(), JSON.stringify(profiles)); } catch (_e) {}
}
function cabinetRefreshProfileSelect() {
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!sel) return;
  var profiles = cabinetLoadProfiles();
  var names = Object.keys(profiles);
  sel.innerHTML = names.length === 0
    ? '<option value="">— no saved profiles —</option>'
    : names.map(function (n) { return '<option value="' + cabinetEscapeText(n) + '">' + cabinetEscapeText(n) + '</option>'; }).join("");
}
function cabinetSetupRemapProfiles() {
  var loadBtn = document.querySelector("#cabinet-remap-profile-load");
  var saveBtn = document.querySelector("#cabinet-remap-profile-save");
  var delBtn = document.querySelector("#cabinet-remap-profile-delete");
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!loadBtn || !saveBtn || !delBtn || !sel) return;
  cabinetRefreshProfileSelect();
  loadBtn.addEventListener("click", function () {
    var name = sel.value;
    if (!name) return;
    var profiles = cabinetLoadProfiles();
    if (!profiles[name]) return;
    cabinetSaveRemap(profiles[name]);
    cabinetApplyRemap(profiles[name]);
    cabinetRenderRemapGrid();
    cabinetToast("Loaded profile: " + name);
  });
  saveBtn.addEventListener("click", function () {
    var name = window.prompt("Profile name:", "");
    if (!name || !name.trim()) return;
    name = name.trim().slice(0, 32);
    var profiles = cabinetLoadProfiles();
    profiles[name] = cabinetLoadRemap() || {};
    cabinetSaveProfiles(profiles);
    cabinetRefreshProfileSelect();
    sel.value = name;
    cabinetToast("Saved profile: " + name);
  });
  delBtn.addEventListener("click", function () {
    var name = sel.value;
    if (!name) return;
    var profiles = cabinetLoadProfiles();
    delete profiles[name];
    cabinetSaveProfiles(profiles);
    cabinetRefreshProfileSelect();
    cabinetToast("Deleted profile: " + name);
  });
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
  if (open) { cabinetSetMenuOpen(false); cabinetRenderRemapGrid(); cabinetRefreshProfileSelect(); }
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
  // Wire up hold-to-rewind on the rewind button
  var rewindBtn = document.querySelector("#cabinet-rewind-toggle");
  if (rewindBtn) {
    rewindBtn.addEventListener("mousedown", function (e) { e.preventDefault(); cabinetStartRewind(); });
    rewindBtn.addEventListener("touchstart", function (e) { e.preventDefault(); cabinetStartRewind(); }, { passive: false });
    rewindBtn.addEventListener("mouseup", cabinetStopRewind);
    rewindBtn.addEventListener("mouseleave", cabinetStopRewind);
    rewindBtn.addEventListener("touchend", cabinetStopRewind);
    rewindBtn.addEventListener("touchcancel", cabinetStopRewind);
  }
});
// ── Server-side save backup/restore ────────────────────────────────────────
var cabinetServerBackups = [];
async function cabinetFetchServerBackups() {
  try {
    var r = await fetch("./save-backups");
    if (!r.ok) return;
    var d = await r.json();
    cabinetServerBackups = d.slots || [];
  } catch (_e) {
    cabinetServerBackups = [];
  }
}
async function cabinetBackupSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) {
    cabinetToast("Game must be running to back up a save");
    return;
  }
  var FS = emulator.gameManager.FS;
  var gameId = window.EJS_gameID || "";
  var statePath = "/" + gameId + "-" + slot + ".state";
  var data;
  try {
    data = FS.readFile(statePath, { encoding: "binary" });
  } catch (_e) {
    cabinetToast("No save data in slot " + slot + " to back up");
    return;
  }
  try {
    var r = await fetch("./save-backup/" + slot, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: data instanceof Uint8Array ? data : new Uint8Array(data),
    });
    if (!r.ok) throw new Error((await r.json()).message || "Failed");
    if (!cabinetServerBackups.includes(slot)) cabinetServerBackups.push(slot);
    cabinetServerBackups.sort(function (a, b) { return a - b; });
    cabinetToast("Slot " + slot + " backed up to server ☁");
    cabinetRenderSaveSlots();
  } catch (err) {
    cabinetToast("Backup failed: " + err.message);
  }
}
async function cabinetRestoreSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) {
    cabinetToast("Game must be running to restore a save");
    return;
  }
  try {
    var r = await fetch("./save-backup/" + slot);
    if (!r.ok) throw new Error("No backup for slot " + slot);
    var buf = await r.arrayBuffer();
    var FS = emulator.gameManager.FS;
    var gameId = window.EJS_gameID || "";
    var statePath = "/" + gameId + "-" + slot + ".state";
    FS.writeFile(statePath, new Uint8Array(buf));
    if (FS.syncfs) FS.syncfs(false, function () {});
    await cabinetRecordSaveSlot(slot);
    cabinetToast("Slot " + slot + " restored from server ☁");
  } catch (err) {
    cabinetToast("Restore failed: " + err.message);
  }
}

// ── Gamepad tester ──────────────────────────────────────────────────────────
function cabinetSetupGamepadPanel() {
  var openBtn = document.querySelector("#cabinet-gamepad-test-open");
  var closeBtn = document.querySelector("#cabinet-gamepad-panel-close");
  var panel = document.querySelector("#cabinet-gamepad-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!openBtn || !panel || !backdrop) return;
  var gpRaf = null;
  function renderGamepads() {
    var statusEl = document.querySelector("#cabinet-gp-status");
    var listEl = document.querySelector("#cabinet-gp-list");
    if (!statusEl || !listEl) return;
    var gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (gamepads.length === 0) {
      statusEl.textContent = "No controller detected. Press any button on your gamepad.";
      listEl.innerHTML = "";
    } else {
      statusEl.textContent = gamepads.length + " controller" + (gamepads.length > 1 ? "s" : "") + " connected.";
      listEl.innerHTML = gamepads.map(function (gp) {
        var btnHtml = (gp.buttons || []).map(function (btn, i) {
          var pressed = btn.pressed || btn.value > 0.1;
          return '<span style="display:inline-block;min-width:28px;padding:3px 5px;margin:2px;border-radius:6px;font:700 9px ui-monospace,monospace;text-align:center;background:' + (pressed ? "#22c55e" : "rgba(248,250,252,0.08)") + ';color:' + (pressed ? "#fff" : "rgba(248,250,252,0.4)") + ';" title="Button ' + i + '">' + i + '</span>';
        }).join("");
        var axisHtml = (gp.axes || []).map(function (v, i) {
          var pct = Math.round((v + 1) * 50);
          return '<span style="display:inline-block;margin:2px 4px;font:600 9px ui-monospace,monospace;color:rgba(248,250,252,0.6);">A' + i + ':<b style="color:#f8fafc;">' + v.toFixed(2) + '</b></span>';
        }).join("");
        return '<div style="background:rgba(248,250,252,0.04);border:1px solid rgba(248,250,252,0.1);border-radius:12px;padding:10px 14px;margin-bottom:6px;">'
          + '<div style="font:700 11px ui-monospace,monospace;color:#f8fafc;margin-bottom:6px;">' + (gp.id || "Unknown Controller") + '</div>'
          + '<div style="margin-bottom:4px;">' + (btnHtml || "<em style='font-style:italic;color:rgba(248,250,252,0.3);font-size:10px;'>No buttons</em>") + '</div>'
          + '<div>' + (axisHtml || "") + '</div>'
          + '</div>';
      }).join("");
    }
    if (panel.getAttribute("aria-hidden") !== "true") {
      gpRaf = requestAnimationFrame(renderGamepads);
    }
  }
  openBtn.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    renderGamepads();
  });
  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    if (gpRaf) { cancelAnimationFrame(gpRaf); gpRaf = null; }
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", function () {
    if (panel.classList.contains("is-open")) closePanel();
  });
  window.addEventListener("gamepadconnected", function (e) {
    cabinetToast("Gamepad connected: " + e.gamepad.id.slice(0, 40));
    if (panel.classList.contains("is-open")) renderGamepads();
  });
  window.addEventListener("gamepaddisconnected", function (e) {
    cabinetToast("Gamepad disconnected");
    if (panel.classList.contains("is-open")) renderGamepads();
  });
}

// ── Netplay ─────────────────────────────────────────────────────────────────
function cabinetGenerateRoomCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "";
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
function cabinetSetupNetplay() {
  var openBtn = document.querySelector("#cabinet-netplay-open");
  var closeBtn = document.querySelector("#cabinet-netplay-close");
  var panel = document.querySelector("#cabinet-netplay-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  var hostBtn = document.querySelector("#cabinet-netplay-host");
  var joinBtn = document.querySelector("#cabinet-netplay-join");
  var hostSection = document.querySelector("#cabinet-netplay-host-section");
  var joinSection = document.querySelector("#cabinet-netplay-join-section");
  var roomCodeEl = document.querySelector("#cabinet-netplay-room-code");
  var codeInput = document.querySelector("#cabinet-netplay-code-input");
  var connectBtn = document.querySelector("#cabinet-netplay-connect");
  var statusEl = document.querySelector("#cabinet-netplay-status");
  if (!openBtn || !panel) return;

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function showSection(which) {
    if (hostSection) hostSection.style.display = which === "host" ? "flex" : "none";
    if (joinSection) joinSection.style.display = which === "join" ? "flex" : "none";
  }

  openBtn.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    showSection(null);
    setStatus("");
  });

  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  if (hostBtn) hostBtn.addEventListener("click", function () {
    var code = cabinetGenerateRoomCode();
    if (roomCodeEl) roomCodeEl.textContent = code;
    showSection("host");
    setStatus("Waiting for opponent to connect…");
    // Wire up EmulatorJS netplay if available
    try {
      if (window.EJS_emulator && typeof window.EJS_emulator.startNetplay === "function") {
        window.EJS_emulator.startNetplay(code);
        setStatus("Room " + code + " open — share the code!");
      } else {
        setStatus("Room code generated. EmulatorJS netplay available once game is loaded.");
      }
    } catch (_e) {
      setStatus("Room code generated — start the game first to activate netplay.");
    }
  });

  if (roomCodeEl) roomCodeEl.addEventListener("click", function () {
    var code = roomCodeEl.textContent || "";
    if (code && code !== "—") {
      navigator.clipboard.writeText(code).then(function () { cabinetToast("Room code copied!"); }).catch(function () {});
    }
  });

  if (joinBtn) joinBtn.addEventListener("click", function () {
    showSection("join");
    setStatus("Enter the host's room code and press Connect.");
    if (codeInput) codeInput.focus();
  });

  if (connectBtn) connectBtn.addEventListener("click", function () {
    var code = (codeInput ? codeInput.value : "").trim().toUpperCase();
    if (!code || code.length < 4) { setStatus("Please enter a valid room code."); return; }
    setStatus("Connecting to room " + code + "…");
    try {
      if (window.EJS_emulator && typeof window.EJS_emulator.joinNetplay === "function") {
        window.EJS_emulator.joinNetplay(code);
        setStatus("Connected to room " + code + "!");
      } else {
        setStatus("Joining room " + code + ". Start the game first to activate netplay.");
      }
    } catch (_e) {
      setStatus("Could not connect — check the room code and try again.");
    }
  });
}

cabinetSetupSystemMenu();
cabinetSetupVirtualPad();
cabinetSetupGamepadPanel();
cabinetSetupRemapProfiles();
cabinetSetupNetplay();
cabinetFetchSaveSlots();
cabinetFetchServerBackups();
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
  // Auto-save on unexpected navigation / tab close
  window.addEventListener("beforeunload", function () {
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try { window.EJS_emulator.saveState(0); } catch (e) { /* ignore */ }
    }
  });
  // Auto-save when tab is hidden (mobile app-switch, screen lock, background)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try {
        window.EJS_emulator.saveState(0);
        cabinetCaptureThumb("auto");
        localStorage.setItem("cabinet_autosave_" + (window.EJS_gameID || ""), String(Date.now()));
      } catch (_e) {}
    }
  });
  // iOS Safari fires pagehide instead of beforeunload when navigating away
  window.addEventListener("pagehide", function () {
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try { window.EJS_emulator.saveState(0); } catch (_e) {}
    }
  });
  // Restore auto-save from previous session (if tab was hidden mid-game)
  var _autoKey = "cabinet_autosave_" + (window.EJS_gameID || "");
  var _autoTs = null;
  try { _autoTs = localStorage.getItem(_autoKey); } catch (_e) {}
  if (_autoTs) {
    try { localStorage.removeItem(_autoKey); } catch (_e) {}
    var _autoMins = Math.round((Date.now() - Number(_autoTs)) / 60000);
    var _autoLabel = _autoMins < 1 ? "just now" : _autoMins + " min ago";
    setTimeout(function () {
      cabinetToast("Resuming auto-save from " + _autoLabel + "…");
      if (window.EJS_emulator && typeof window.EJS_emulator.loadState === "function") {
        try { window.EJS_emulator.loadState(0); } catch (_e) {}
      }
    }, 2500);
  }
};
window.EJS_player = "#game";
window.EJS_core = ${JSON.stringify(core)};
window.CABINET_CORE = ${JSON.stringify(core)};
window.EJS_gameName = ${JSON.stringify(title)};
window.EJS_gameID = ${JSON.stringify(userId + "_" + gameId)};
window.CABINET_USER_ID = ${JSON.stringify(userId)};
window.CABINET_USER_NAME = ${JSON.stringify(userName)};
(function () {
  var name = window.CABINET_USER_NAME || "";
  var el = document.getElementById("cabinet-save-user");
  if (el) el.textContent = name || "you";
  var badge = document.getElementById("cabinet-user-badge");
  if (badge && name && name !== "default") { badge.textContent = name; badge.removeAttribute("hidden"); }
})();
${discs.length > 1
  ? `window.EJS_discs = ${JSON.stringify(discs.map((d) => ({ fileName: `../\${d.id}/file`, label: d.label })))};`
  : `window.EJS_gameUrl = "./file";`}
window.EJS_pathtodata = "../../emulatorjs/";
window.EJS_startOnLoaded = true;
window.EJS_AdUrl = "";
${raUsername && raToken ? `window.EJS_retroachievements = { username: ${JSON.stringify(raUsername)}, apiKey: ${JSON.stringify(raToken)}, hardcore: false };` : "// RetroAchievements not configured"}
window.EJS_rewindEnabled = true;
window.EJS_rewindGranularity = 2;
window.EJS_fastForwardSpeed = 3;
window.EJS_controlScheme = ${JSON.stringify(core)};
window.EJS_defaultControls = ${JSON.stringify(buildEjsControls(core, controlDefaults))};
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
loader.src = "../../emulatorjs/loader.js";
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
