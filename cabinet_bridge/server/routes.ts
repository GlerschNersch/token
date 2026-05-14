himport type { Express } from "express";
import type { Server } from 'node:http';
import { storage } from "./storage"
import * as scanner from './scanner';
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
  insertActivityLogSchema,
} from "@shared/schema";
import {
  SYSTEM_IMAGES,
  isSystemImageId,
  type SystemImageId,
} from "@shared/system-images";
import { z } from "zod";
import { getHltbData } from "./hltb.js";

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
const SYSTEM_LOGO_CACHE_DIR  = path.resolve(dataPath("system-logo-cache"));

import { getCachedSystemImage, fetchTheGamesDBMeta, fetchScreenScraperMeta, findLibretroBoxArt, slugify } from "./scraperHelpers.js";
import { renderEmulatorPage, renderPlayerError } from "./emulatorPage.js";
import { renderEmulatorBootstrap } from "./emulatorBootstrap.js";

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

function titleFromFileName(filename: string): string {
    return filename
      .replace(/(\.[a-zA-Z0-9]+)+$/, '') // strip extension(s)
      .replace(/[_\-.]+/g, ' ')           // underscores/hyphens/dots to spaces
      .trim()
      .replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Auto-configure HA panel_iframe so HomeArcade is accessible to all HA users.
// Runs once at startup inside the HA add-on environment (SUPERVISOR_TOKEN set).
// Writes a panel_iframe entry to /config/configuration.yaml if not already
// present, then asks HA to reload integrations so the panel appears immediately.
// ---------------------------------------------------------------------------
function titleFromFileName(filename: string): string {  return filename(): Promise<void> {
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
    const { userId: haUserId, userName } = getUserFromRequest(req);
    // Profile override: ?profile=<id> lets client-side profiles silo saves
    const profileParam = req.query.profile ? String(req.query.profile) : null;
    const userId = profileParam ? `profile_${profileParam}` : haUserId;
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
      controlDefaults: await (async () => {
        const global = (bootstrapSettings.controlDefaults ?? {}) as Record<string, Record<number, string>>;
        const pId = profileParam ? Number(profileParam) : 1;
        // Merge profile-specific overrides on top of global defaults per core
        const merged: Record<string, Record<number, string>> = { ...global };
        // Load all known cores used for this ROM's system (just preload the one core)
        const profileBindings = await storage.getProfileControlBindings(pId, core);
        if (Object.keys(profileBindings).length > 0) {
          merged[core] = { ...(global[core] ?? {}), ...profileBindings };
        }
        return merged;
      })(),
      gamepadBindings: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        // "default" slot covers all connected gamepads unless a specific one is saved
        return await storage.getGamepadBindings(pId, "default");
      })(),
      controlDefaultsP2: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        return await storage.getProfileControlBindings(pId, `${core}_p2`);
      })(),
      gamepadBindingsP2: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        return await storage.getGamepadBindings(pId, "default_p2");
      })(),
      gamepadRumble: bootstrapSettings.gamepadRumble ?? true,
      systemDisplay: (bootstrapSettings.systemDisplay ?? {}) as Record<string, { aspectRatio?: string; integerScale?: boolean; shader?: string }>,
      userId,
      userName,
      profileId: profileParam ?? "1",
      cheats: await storage.listCheats(rom.id, profileParam ? Number(profileParam) : 1)
        .then((cs) => cs.filter((c) => c.enabled)),
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

  // ── Profiles ──────────────────────────────────────────────────────────────
  app.get("/api/profiles", async (_req, res) => {
    res.json(await storage.listProfiles());
  });
  app.post("/api/profiles", express.json(), async (req, res) => {
    const { name, color } = req.body ?? {};
    if (!name || typeof name !== "string") return res.status(400).json({ message: "name required" });
    const profile = await storage.createProfile(String(name).trim().slice(0, 32), color || "#8b5cf6");
    res.status(201).json(profile);
  });
  app.delete("/api/profiles/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (id === 1) return res.status(400).json({ message: "Cannot delete default profile" });
    const ok = await storage.deleteProfile(id);
    res.json({ ok });
  });


  // ── Per-profile game state ────────────────────────────────────────────────
  // GET  /api/profiles/:profileId/game-states         → all states for profile
  // GET  /api/profiles/:profileId/game-states/:romId  → single state
  // PATCH /api/profiles/:profileId/game-states/:romId → upsert favorite/rating/playStatus
  app.get("/api/profiles/:profileId/game-states", async (req, res) => {
    const profileId = Number(req.params.profileId);
    res.json(await storage.listProfileGameStates(profileId));
  });
  app.get("/api/profiles/:profileId/game-states/:romId", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const romId = Number(req.params.romId);
    const state = await storage.getProfileGameState(profileId, romId);
    res.json(state ?? null);
  });
  app.patch("/api/profiles/:profileId/game-states/:romId", express.json(), async (req, res) => {
    const profileId = Number(req.params.profileId);
    const romId = Number(req.params.romId);
    const { favorite, rating, playStatus } = req.body ?? {};
    const patch: { favorite?: boolean; rating?: number; playStatus?: string } = {};
    if (favorite !== undefined) patch.favorite = Boolean(favorite);
    if (rating !== undefined) patch.rating = Number(rating);
    if (playStatus !== undefined) patch.playStatus = String(playStatus);
    const state = await storage.upsertProfileGameState(profileId, romId, patch);
    res.json(state);
  });

  // ── Per-profile control bindings ──────────────────────────────────────────
  // GET  /api/profiles/:profileId/controls/:core  → { [buttonIndex]: keyName }
  // PUT  /api/profiles/:profileId/controls/:core  → save bindings
  // DELETE /api/profiles/:profileId/controls/:core → reset to global defaults
  // ?port=0 (default) → Player 1; ?port=1 → Player 2 (stored under core_p2 key)
  app.get("/api/profiles/:profileId/controls/:core", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const coreKey = port === 1 ? `${req.params.core}_p2` : req.params.core;
    res.json(await storage.getProfileControlBindings(profileId, coreKey));
  });
  app.put("/api/profiles/:profileId/controls/:core", express.json(), async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const coreKey = port === 1 ? `${req.params.core}_p2` : req.params.core;
    const bindings = req.body as Record<number, string>;
    if (typeof bindings !== "object" || bindings === null) return res.status(400).json({ message: "bindings must be an object" });
    await storage.setProfileControlBindings(profileId, coreKey, bindings);
    res.json({ ok: true });
  });
  app.delete("/api/profiles/:profileId/controls/:core", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const coreKey = port === 1 ? `${req.params.core}_p2` : req.params.core;
    await storage.setProfileControlBindings(profileId, coreKey, {});
    res.json({ ok: true });
  });


  // ── Gamepad bindings ──────────────────────────────────────────────────────
  // GET  /api/profiles/:profileId/gamepad-bindings              → all saved gamepads
  // GET  /api/profiles/:profileId/gamepad-bindings/:gamepadId   → bindings for one gamepad
  // PUT  /api/profiles/:profileId/gamepad-bindings/:gamepadId   → save bindings
  // DELETE /api/profiles/:profileId/gamepad-bindings/:gamepadId → clear bindings
  app.get("/api/profiles/:profileId/gamepad-bindings", async (req, res) => {
    const profileId = Number(req.params.profileId);
    res.json(await storage.listGamepadBindings(profileId));
  });
  // ?port=0 (default) → Player 1; ?port=1 → Player 2 (stored under gamepadId_p2 key)
  app.get("/api/profiles/:profileId/gamepad-bindings/:gamepadId", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const baseId = decodeURIComponent(req.params.gamepadId);
    const gamepadId = port === 1 ? `${baseId}_p2` : baseId;
    res.json(await storage.getGamepadBindings(profileId, gamepadId));
  });
  app.put("/api/profiles/:profileId/gamepad-bindings/:gamepadId", express.json(), async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const baseId = decodeURIComponent(req.params.gamepadId);
    const gamepadId = port === 1 ? `${baseId}_p2` : baseId;
    const bindings = req.body as Record<number, number>;
    if (typeof bindings !== "object" || bindings === null) {
      return res.status(400).json({ message: "bindings must be an object" });
    }
    await storage.setGamepadBindings(profileId, gamepadId, bindings);
    res.json({ ok: true });
  });
  app.delete("/api/profiles/:profileId/gamepad-bindings/:gamepadId", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const baseId = decodeURIComponent(req.params.gamepadId);
    const gamepadId = port === 1 ? `${baseId}_p2` : baseId;
    await storage.setGamepadBindings(profileId, gamepadId, {});
    res.json({ ok: true });
  });

  // ── Cheats ────────────────────────────────────────────────────────────────
  app.get("/api/roms/:id/cheats", async (req, res) => {
    const romId = Number(req.params.id);
    const profileId = Number(req.query.profileId ?? 1);
    res.json(await storage.listCheats(romId, profileId));
  });
  app.post("/api/roms/:id/cheats", express.json(), async (req, res) => {
    const romId = Number(req.params.id);
    const { description, code, profileId } = req.body ?? {};
    if (!code || !description) return res.status(400).json({ message: "code and description required" });
    const pId = Number(profileId ?? 1);
    const existing = await storage.listCheats(romId, pId);
    const normalCode = String(code).trim().toUpperCase();
    if (existing.some((c) => c.code.toUpperCase() === normalCode)) {
      return res.status(409).json({ message: "A cheat with this code already exists for this game." });
    }
    const cheat = await storage.createCheat({
      romId, profileId: pId,
      description: String(description).slice(0, 128),
      code: String(code).slice(0, 256),
      enabled: true, createdAt: Date.now(),
    });
    res.status(201).json(cheat);
  });
  app.patch("/api/cheats/:id", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const { enabled } = req.body ?? {};
    res.json({ ok: await storage.updateCheatEnabled(id, !!enabled) });
  });
  app.delete("/api/cheats/:id", async (req, res) => {
    const id = Number(req.params.id);
    res.json({ ok: await storage.deleteCheat(id) });
  });


  // GET /api/roms/:id/fetch-cheats — pull from libretro cheat database (with SQLite cache)
  app.get("/api/roms/:id/fetch-cheats", async (req, res) => {
    const romId = Number(req.params.id);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const SYSTEM_FOLDERS: Record<string, string> = {
      // Nintendo
      nes:          "Nintendo - Nintendo Entertainment System",
      snes:         "Nintendo - Super Nintendo Entertainment System",
      n64:          "Nintendo - Nintendo 64",
      gb:           "Nintendo - Game Boy",
      gbc:          "Nintendo - Game Boy Color",
      gba:          "Nintendo - Game Boy Advance",
      nds:          "Nintendo - Nintendo DS",
      virtualboy:   "Nintendo - Virtual Boy",
      // Sony
      ps1:          "Sony - PlayStation",
      psx:          "Sony - PlayStation",
      ps2:          "Sony - PlayStation 2",
      psp:          "Sony - PlayStation Portable",
      // Sega
      genesis:      "Sega - Mega Drive - Genesis",
      megadrive:    "Sega - Mega Drive - Genesis",
      sms:          "Sega - Master System - Mark III",
      gamegear:     "Sega - Game Gear",
      segacd:       "Sega - Mega-CD - Sega CD",
      sega32x:      "Sega - 32X",
      saturn:       "Sega - Saturn",
      dreamcast:    "Sega - Dreamcast",
      // Atari
      atari2600:    "Atari - 2600",
      atari7800:    "Atari - 7800",
      lynx:         "Atari - Lynx",
      // NEC
      pce:          "NEC - PC Engine - TurboGrafx 16",
      // SNK
      neogeo:       "SNK - Neo Geo",
      // Arcade
      arcade:       "MAME",
      mame:         "MAME",
    };

    const folder = SYSTEM_FOLDERS[rom.system?.toLowerCase() ?? ""];
    if (!folder) return res.json({ cheats: [], message: "No cheat database for this system." });

    // 1. Get directory index — from cache or GitHub
    let files = await storage.getCheatIndex(folder);
    if (!files) {
      const contentsUrl =
        `https://api.github.com/repos/libretro/libretro-database/contents/cht/${encodeURIComponent(folder)}`;
      try {
        const contentsRes = await fetch(contentsUrl, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "HomeArcade/1.0" },
        });
        if (!contentsRes.ok) return res.json({ cheats: [], message: "Could not reach cheat database." });
        const raw = await contentsRes.json() as { name: string; path: string }[];
        files = raw.filter((f) => f.name.endsWith(".cht"));
        await storage.setCheatIndex(folder, files);
      } catch {
        return res.json({ cheats: [], message: "Network error reaching cheat database." });
      }
    }

    // 2. Fuzzy-match title against directory listing
    const normalise = (s: string) =>
      s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9\s]/g, " ").trim();

    const titleWords = new Set(normalise(rom.title).split(/\s+/).filter(Boolean));
    let bestPath: string | null = null;
    let bestScore = 0;

    for (const file of files) {
      const fileWords = normalise(file.name.replace(/\.cht$/, "")).split(/\s+/).filter(Boolean);
      let score = 0;
      for (const w of fileWords) { if (titleWords.has(w)) score++; }
      if (normalise(file.name).startsWith(normalise(rom.title).slice(0, 6))) score += 2;
      if (score > bestScore) { bestScore = score; bestPath = file.path; }
    }

    if (!bestPath || bestScore < 1) {
      return res.json({ cheats: [], message: "No cheat file found for this game." });
    }

    // 3. Get parsed cheats — from cache or GitHub raw
    let cheats = await storage.getCachedCheats(bestPath);
    if (!cheats) {
      let chtText = "";
      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/libretro/libretro-database/master/${bestPath}`,
          { headers: { "User-Agent": "HomeArcade/1.0" } },
        );
        if (!rawRes.ok) return res.json({ cheats: [], message: "Could not download cheat file." });
        chtText = await rawRes.text();
      } catch {
        return res.json({ cheats: [], message: "Network error fetching cheat file." });
      }

      // Handles both combined (cheatN_code) and split (cheatN_address + cheatN_value) styles
      const entries: Record<number, { desc?: string; code?: string; address?: string; value?: string }> = {};
      for (const line of chtText.split(/\r?\n/)) {
        const m = line.match(/^cheat(\d+)_(desc|code|address|value)\s*=\s*"(.*)"\s*$/);
        if (!m) continue;
        const idx = Number(m[1]);
        if (!entries[idx]) entries[idx] = {};
        (entries[idx] as Record<string, string>)[m[2]] = m[3].trim();
      }

      cheats = Object.values(entries)
        .filter((e) => e.desc && (e.code || (e.address && e.value)))
        .map((e) => ({ desc: e.desc!, code: e.code ?? `${e.address}+${e.value}` }));

      await storage.setCachedCheats(bestPath, cheats);
    }

    res.json({ cheats, source: bestPath, cached: true });
  });

  // DELETE /api/cheat-cache — clear cached cheat index and file data
  app.delete("/api/cheat-cache", async (_req, res) => {
    await storage.clearCheatCache();
    res.json({ ok: true });
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


  app.patch("/api/collections/:id", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ name: z.string().trim().min(1).max(48) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Collection name must be 1-48 characters." });
    }
    const updated = await storage.renameCollection(id, parsed.data.name);
    if (!updated) {
      return res.status(404).json({ message: "Collection not found." });
    }
    res.json(updated);
  });

  // ── Smart filter collections ────────────────────────────────────────────
  const smartFilterRulesSchema = z.object({
    systems:          z.array(z.string().max(32)).optional(),
    playStatus:       z.array(z.string().max(32)).optional(),
    minRating:        z.number().int().min(0).max(5).optional(),
    minMinutesPlayed: z.number().int().min(0).optional(),
    favorites:        z.boolean().optional(),
    genre:            z.string().max(128).optional(),
  });

  app.post("/api/collections/smart", express.json(), async (req, res) => {
    const parsed = z.object({
      name:  z.string().trim().min(1).max(48),
      rules: smartFilterRulesSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid smart filter payload." });
    }
    const collection = await storage.createSmartFilterCollection(parsed.data.name, parsed.data.rules);
    const all = await storage.listCollections();
    const withItems = all.find((c) => c.id === collection.id) ?? { ...collection, romIds: [] };
    return res.status(201).json(withItems);
  });

  app.patch("/api/collections/:id/smart", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = smartFilterRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid smart filter rules." });
    }
    const updated = await storage.updateSmartFilterCollection(id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Collection not found." });
    }
    const all = await storage.listCollections();
    const withItems = all.find((c) => c.id === id) ?? { ...updated, romIds: [] };
    return res.json(withItems);
  });

  // ── ROM scanner ──────────────────────────────────────────────────────────────────────
  app.get("/api/scanner/status", (_req, res) => {
    res.json(scanner.getStatus());
  });

  app.post("/api/scanner/scan-now", async (_req, res) => {
    try {
      await scanner.scanNow();
      res.json({ ok: true, status: scanner.getStatus() });
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  // ── Netplay lobby ─────────────────────────────────────────────────────────────────
  app.get("/api/netplay/rooms", (_req, res) => {
    res.json(listOpenRooms());
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
      const tgdbMeta = await fetchTheGamesDBMeta(system, title, settings.tgdbApiKey ?? "");
      const ssMeta = tgdbMeta?.artUrl ? null : await fetchScreenScraperMeta(system, safeName, title, settings.ssUserId, settings.ssPassword);
      const activeMeta = tgdbMeta ?? ssMeta;
      const libretroArt = activeMeta?.artUrl ? null : await findLibretroBoxArt(system, title);

      const rom = insertUploadedRomSchema.parse({
        title,
        system,
        slug,
        originalName,
        fileName: safeName,
        filePath,
        size: body.length,
        mimeType: req.header("content-type") ?? "application/octet-stream",
        artUrl: activeMeta?.artUrl ?? libretroArt?.url ?? null,
        scrapeStatus: activeMeta?.scrapeStatus ?? (libretroArt?.url ? "matched" : "not_found"),
        scrapeMessage: activeMeta?.scrapeMessage ?? libretroArt?.message ?? "",
        description: activeMeta?.description ?? null,
        releaseYear: activeMeta?.releaseYear ?? null,
        developer: activeMeta?.developer ?? null,
        publisher: activeMeta?.publisher ?? null,
        genre: activeMeta?.genre ?? null,
        players: activeMeta?.players ?? null,
        communityScore: (activeMeta as any)?.communityScore ?? null,
        wheelArtUrl: (activeMeta as any)?.wheelArtUrl ?? null,
        videoUrl: (activeMeta as any)?.videoUrl ?? null,
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
    const tgdbMeta = await fetchTheGamesDBMeta(rom.system, rom.title, settings.tgdbApiKey ?? "");
    const ssMeta = tgdbMeta?.artUrl ? null : await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.ssUserId, settings.ssPassword);
    const activeMeta = tgdbMeta ?? ssMeta;
    const libretroArt = activeMeta?.artUrl ? null : await findLibretroBoxArt(rom.system, rom.title);

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
        const tgdbMeta = await fetchTheGamesDBMeta(rom.system, rom.title, settings.tgdbApiKey ?? "");
        const ssMeta = tgdbMeta?.artUrl ? null : await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.ssUserId, settings.ssPassword);
        const activeMeta = tgdbMeta ?? ssMeta;
        const libretroArt = activeMeta?.artUrl ? null : await findLibretroBoxArt(rom.system, rom.title);
        const status = activeMeta?.scrapeStatus ?? (libretroArt?.url ? "matched" : "not_found");

        await storage.updateUploadedRomMetadata(rom.id, {
          artUrl: activeMeta?.artUrl ?? libretroArt?.url ?? null,
          scrapeStatus: status,
          scrapeMessage: activeMeta?.scrapeMessage ?? libretroArt?.message ?? "",
          description: activeMeta?.description ?? undefined,
          releaseYear: activeMeta?.releaseYear ?? undefined,
          developer: activeMeta?.developer ?? undefined,
          publisher: activeMeta?.publisher ?? undefined,
          genre: activeMeta?.genre ?? undefined,
          players: activeMeta?.players ?? undefined,
          communityScore: (activeMeta as any)?.communityScore ?? undefined,
          wheelArtUrl: (activeMeta as any)?.wheelArtUrl ?? undefined,
          videoUrl: (activeMeta as any)?.videoUrl ?? undefined,
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
    let resolvedDuration: number | undefined;
    if (event === "started") {
      nowPlayingRom = { id: rom.id, title: rom.title, system: rom.system };
      activeSessionStart = Date.now();
      activeSessionId = await storage.createPlaySession(rom.id, rom.title, rom.system, activeSessionStart).catch(() => null);
    } else {
      nowPlayingRom = null;
      if (activeSessionId) {
        const endedAt = Date.now();
        resolvedDuration = durationSeconds ?? Math.round((endedAt - activeSessionStart) / 1000);
        await storage.endPlaySession(activeSessionId, endedAt, resolvedDuration).catch(() => {});
        activeSessionId = null;
      } else {
        resolvedDuration = durationSeconds;
      }
    }

    const settings = await storage.getIntegrationSettings();
    // Accumulate real play time
    if (event === "ended" && resolvedDuration && resolvedDuration > 0) {
      const minutes = resolvedDuration / 60;
      await storage.incrementRomMinutesPlayed(id, minutes).catch(() => {});
    }

    if (settings.haBaseUrl && settings.haToken) {
      const eventType = event === "started" ? "homearcade_game_started" : "homearcade_game_ended";
      const payload: Record<string, unknown> = {
        game: rom.title,
        system: rom.system,
        rom_id: rom.id,
        art_url: rom.artUrl ?? "",
        players: rom.players ?? 1,
        developer: rom.developer ?? "Unknown",
        genre: rom.genre ?? "Action",
        release_year: rom.releaseYear ?? null,
      };
      if (event === "ended" && resolvedDuration !== undefined) {
        payload.duration_seconds = resolvedDuration;
        payload.duration_minutes = Math.round(resolvedDuration / 60);
      }
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

  // ── ROM scanner init ───────────────────────────────────────────────────────────
  const CABINET_ROM_WATCH_DIR = process.env.CABINET_ROM_WATCH_DIR;
  if (CABINET_ROM_WATCH_DIR) {
    scanner.initScanner(
      CABINET_ROM_WATCH_DIR,
      (rom) => storage.addScannedRom(rom),
      ()    => storage.listRomFilenames(),
    );
    console.log(`[Scanner] Watching ${CABINET_ROM_WATCH_DIR} for new ROMs (60s poll).`);
  }


  // GET /api/roms/:id/hltb — fetch How Long To Beat times (cached 7 days)
  app.get("/api/roms/:id/hltb", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ROM id" });
      const rom = await storage.getRom(id);
      if (!rom) return res.status(404).json({ error: "ROM not found" });
      const forceRefresh = req.query.refresh === "1";
      const title = (rom as any).gameName || (rom as any).game_name || (rom as any).filename || "";
      const data = await getHltbData(id, title, forceRefresh);
      if (!data) return res.status(404).json({ error: "No HLTB data found for this title" });
      return res.json(data);
    } catch (err) {
      console.error("[HLTB route]", err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // ── Activity Log ──────────────────────────────────────────────────────────
  app.get("/api/activity-log", async (_req, res) => {
    try {
      const logs = await storage.listActivityLog(100);
      res.json(logs);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/activity-log", express.json(), async (req, res) => {
    try {
      const parsed = insertActivityLogSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const entry = await storage.addActivityLogEntry(parsed.data);
      res.status(201).json(entry);
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.delete("/api/activity-log", async (_req, res) => {
    await storage.clearActivityLog();
    res.status(204).end();
  });

  return httpServer;
}
