import type { Express } from "express";
import express from "express";
import { storage } from "../storage";
import { 
  ROM_EXTENSIONS, MAX_UPLOAD_MB, MAX_UPLOAD_BYTES, 
  EMULATORJS_CORES, ROM_ROOT, getUserFromRequest 
} from "./shared";
import { renderEmulatorPage, renderEmulatorBootstrap, renderPlayerError } from "./player";
import { REQUIRED_BIOS } from "./bios";
import { dataPath } from "../data-dir";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { insertUploadedRomSchema } from "@shared/schema";
import { extractFirstRomFromZip, titleFromFileName, slugify } from "./utils";
import { fetchTheGamesDBMeta, fetchScreenScraperMeta, findLibretroBoxArt } from "./scrape";
import QRCode from "qrcode";

// ── EmulatorJS asset disk cache ─────────────────────────────────────────────
// Caches CDN assets on disk so repeated visits (or different users launching
// the same core) don't re-fetch the same WASM / JS from the internet.
const EJS_CACHE_DIR = dataPath("ejs_cache");
let ejsCacheDirReady = false;
async function ensureEjsCacheDir() {
  if (ejsCacheDirReady) return;
  await fs.mkdir(EJS_CACHE_DIR, { recursive: true });
  ejsCacheDirReady = true;
}

export function registerRomRoutes(app: Express) {
  const BIOS_ROOT = dataPath("bios");

  app.get("/api/roms/warp-qr", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!url) return res.status(400).send("No URL provided");
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 400,
        color: { dark: "#000000", light: "#ffffff" }
      });
      res.json({ dataUrl });
    } catch (err) {
      res.status(500).json({ message: "QR generation failed" });
    }
  });

  app.get("/api/upload-limits", (_req, res) => {
    res.json({
      maxUploadMb: MAX_UPLOAD_MB,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      allowedExtensions: ROM_EXTENSIONS,
    });
  });

  app.post(
    "/api/roms/upload",
    async (req, res) => {
      const system = String(req.query.system ?? "");
      const favorite = req.query.favorite !== "0";
      const allowedExtensions = ROM_EXTENSIONS[system];

      if (!allowedExtensions) {
        return res.status(400).json({ message: "Choose a supported console before uploading." });
      }

      const originalName = decodeURIComponent(String(req.header("x-rom-filename") ?? "uploaded.rom"));
      const extension = path.extname(originalName).toLowerCase();
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
        return res.status(400).json({ message: `Unsupported file type for ${system}. Allowed: ${allowedExtensions.join(", ")}` });
      }

      const baseSlug = slugify(titleFromFileName(originalName));
      const uniqueSuffix = Date.now().toString(36);
      const slug = `${system}_${baseSlug}_${uniqueSuffix}`;
      const safeName = `${slug}${extension}`;
      const systemDir = path.join(ROM_ROOT, system);
      const filePath = path.join(systemDir, safeName);

      await fs.mkdir(systemDir, { recursive: true });

      const hash = crypto.createHash("md5");
      let totalSize = 0;

      try {
        const sizeAndHashTransform = new Transform({
          transform(chunk, _encoding, callback) {
            totalSize += chunk.length;
            if (totalSize > MAX_UPLOAD_BYTES) {
              callback(new Error("File too large"));
              return;
            }
            hash.update(chunk);
            callback(null, chunk);
          },
        });

        const writeStream = fsSync.createWriteStream(filePath);
        await pipeline(req, sizeAndHashTransform, writeStream);
      } catch (err: any) {
        if (fsSync.existsSync(filePath)) await fs.unlink(filePath).catch(() => {});
        return res.status(err.message === "File too large" ? 413 : 500).json({
          message: err.message === "File too large" ? `File exceeds ${MAX_UPLOAD_MB}MB limit` : "Upload failed",
        });
      }

      const romHash = hash.digest("hex");
      const title = titleFromFileName(originalName);
      const discMatch = title.match(/\s*[\(\[](?:disc|disk|cd)\s*(\d+)[\)\]]|\s+(?:disc|disk|cd)\s*(\d+)/i);
      const discNumber = discMatch ? parseInt(discMatch[1] ?? discMatch[2], 10) : null;
      const cleanTitle = discMatch ? title.replace(discMatch[0], "").trim() : title;
      const discGroup = discMatch ? `${system}/${slugify(cleanTitle)}` : null;

      const settings = await storage.getIntegrationSettings();
      let activeMeta: any = null;

      // Try High-Detail Scrapers first
      if (settings.ssUserId && settings.ssPassword) {
        activeMeta = await fetchScreenScraperMeta(system, safeName, cleanTitle, settings.ssUserId, settings.ssPassword);
      }
      if (!activeMeta && settings.tgdbApiKey) {
        activeMeta = await fetchTheGamesDBMeta(system, cleanTitle, settings.tgdbApiKey);
      }

      // Fallback to Libretro (art only)
      let libretroArt: { url: string | null; message: string } | null = null;
      if (!activeMeta) {
        libretroArt = await findLibretroBoxArt(system, cleanTitle);
      }

      const rom = insertUploadedRomSchema.parse({
        title: cleanTitle,
        system,
        slug,
        originalName,
        fileName: safeName,
        filePath,
        size: totalSize,
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

      // Re-sync progress if this exact ROM file was uploaded before
      if (romHash) {
        await storage.relinkSaveSlotsByHash(saved.id, romHash);
      }

      res.status(201).json(saved);
    },
  );

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

  app.get("/api/roms/:id/video", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });
    const videoUrl = (rom as any).videoUrl as string | null;
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
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch {
      res.status(502).json({ message: "Video fetch error." });
    }
  });

  // ── EmulatorJS CDN proxy with disk cache ──────────────────────────────────
  // Assets are immutable once fetched (WASM, JS cores, etc.).
  // We cache them on disk so subsequent requests are served locally at LAN
  // speed (~100-1000×) instead of round-tripping to the CDN every time.
  app.get("/api/emulatorjs/*path", async (req, res) => {
    const filePath = Array.isArray(req.params.path)
      ? (req.params.path as string[]).join("/")
      : ((req.params as any).path ?? "");
    if (!filePath || filePath.includes("..")) {
      return res.status(400).send("Invalid path");
    }

    await ensureEjsCacheDir();

    // Determine content-type from extension
    const ext = path.extname(filePath).toLowerCase();
    const MIME: Record<string, string> = {
      ".js": "application/javascript",
      ".wasm": "application/wasm",
      ".data": "application/octet-stream",
      ".mem": "application/octet-stream",
      ".json": "application/json",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
    };
    const contentType = MIME[ext] ?? "application/octet-stream";

    // Sanitize the CDN path to a safe cache key (replace slashes with __ to keep flat)
    const cacheKey = filePath.replace(/[\/\\]/g, "__");
    const cachePath = path.join(EJS_CACHE_DIR, cacheKey);

    // Serve from disk cache if available
    try {
      const stat = await fs.stat(cachePath);
      if (stat.isFile() && stat.size > 0) {
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        res.setHeader("X-Cache", "HIT");
        // Support Range requests so browsers can stream large WASM files
        const rangeHeader = req.headers.range;
        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
          res.setHeader("Content-Length", String(chunkSize));
          res.status(206);
          fsSync.createReadStream(cachePath, { start, end }).pipe(res);
        } else {
          res.setHeader("Accept-Ranges", "bytes");
          fsSync.createReadStream(cachePath).pipe(res);
        }
        return;
      }
    } catch {
      // not cached yet — fall through to CDN fetch
    }

    // Fetch from CDN and simultaneously write to disk cache + stream to client
    const cdnUrl = `https://cdn.emulatorjs.org/stable/data/${filePath}`;
    try {
      const upstream = await fetch(cdnUrl, {
        headers: { "User-Agent": "CabinetBridge/0.1" },
        signal: AbortSignal.timeout(30000),
      });
      if (!upstream.ok || !upstream.body) {
        return res.status(upstream.status).send("CDN error");
      }
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("X-Cache", "MISS");
      const cl = upstream.headers.get("Content-Length");
      if (cl) res.setHeader("Content-Length", cl);

      const { Readable, PassThrough } = await import("stream");
      const readable = Readable.fromWeb(upstream.body as any);
      const passToClient = new PassThrough();
      const passToCache = new PassThrough();

      readable.pipe(passToClient);
      readable.pipe(passToCache);

      passToClient.pipe(res);

      // Write cache file in background; don't block or fail the response
      const tmpPath = `${cachePath}.tmp`;
      const writeStream = fsSync.createWriteStream(tmpPath);
      passToCache.pipe(writeStream);
      writeStream.on("finish", () => {
        fsSync.rename(tmpPath, cachePath, () => {});
      });
      writeStream.on("error", () => {
        fsSync.unlink(tmpPath, () => {});
      });
    } catch {
      res.status(502).send("EmulatorJS CDN unreachable");
    }
  });

  // ── ROM file download — Range-aware so browsers can stream large ROMs ─────
  // Without Accept-Ranges the browser must fully buffer the ROM before
  // EmulatorJS can start the core.  With Range support it can begin booting
  // as soon as the first chunk arrives.
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

    let stat: fsSync.Stats;
    try {
      stat = fsSync.statSync(resolved);
    } catch {
      return res.status(404).json({ message: "ROM file not found on disk." });
    }

    const mimeType = rom.mimeType || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${rom.originalName.replace(/"/g, "")}"`);
    res.setHeader("Accept-Ranges", "bytes");
    // 1-hour browser cache for ROMs (immutable content, large files)
    res.setHeader("Cache-Control", "private, max-age=3600");

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        return res.status(416).end();
      }
      const chunkSize = end - start + 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", String(chunkSize));
      res.status(206);
      fsSync.createReadStream(resolved, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", String(stat.size));
      fsSync.createReadStream(resolved).pipe(res);
    }
  });

  app.get("/api/roms/:id/discs", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "Uploaded ROM not found." });
    if (!rom.discGroup) return res.json([rom]);
    const discs = await storage.listRomsByDiscGroup(rom.discGroup);
    res.json(discs.length > 0 ? discs : [rom]);
  });

  app.get("/api/roms/:id/player", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).send(renderPlayerError("Uploaded ROM not found."));
    const core = EMULATORJS_CORES[rom.system];
    if (!core) return res.status(400).send(renderPlayerError(`${rom.system.toUpperCase()} is not configured for browser play yet.`));
    await storage.markUploadedRomPlayed(id);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Short cache: the HTML shell rarely changes but we don't want stale BIOS errors
    res.setHeader("Cache-Control", "private, max-age=60");
    // Allow scripts, WASM, and blobs inside HA Ingress iframe which may inject restrictive CSP
    res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' blob: data: https:; img-src 'self' blob: data: https:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline';");
    const returnTo = typeof req.query.return === "string" ? req.query.return : "";
    res.send(renderEmulatorPage({ title: rom.title, returnTo, romHash: rom.romHash ?? null }));
  });

  app.get("/api/roms/:id/bootstrap.js", async (req, res) => {
    try {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.status(404).send(`document.body.textContent = "Uploaded ROM not found.";`);
    }
    const core = EMULATORJS_CORES[rom.system];
    if (!core) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      return res.status(400).send(`document.body.textContent = ${JSON.stringify(`${rom.system.toUpperCase()} is not configured for browser play yet.`)};`);
    }
    let discs: Array<{ id: number; label: string }> = [];
    if (rom.discGroup) {
      const siblings = await storage.listRomsByDiscGroup(rom.discGroup);
      if (siblings.length > 1) {
        discs = siblings.map((s) => ({ id: s.id, label: s.discNumber ? `Disc ${s.discNumber}` : s.title, }));
      }
    }
    const bootstrapSettings = await storage.getIntegrationSettings();
    const { userId: haUserId, userName } = getUserFromRequest(req);
    const profileParam = req.query.profile ? String(req.query.profile) : null;
    const userId = profileParam ? `profile_${profileParam}` : haUserId;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    // Bootstrap content is stable for a given ROM+profile combination;
    // a short cache avoids regenerating it on every page reload.
    res.setHeader("Cache-Control", "private, max-age=300");

    const coreBios = REQUIRED_BIOS[core] || [];
    let biosUrl: string | null = null;
    for (const meta of coreBios) {
      try {
        await fs.access(path.join(BIOS_ROOT, meta.filename));
        biosUrl = `/api/bios/file/${meta.filename}`;
        break;
      } catch {
      }
    }

    // BIOS gate: if this core requires a BIOS and none is present, surface a
    // clear error in the launch overlay instead of silently hanging.
    // Return 200 so the script actually executes and shows the error message.
    if (coreBios.length > 0 && !biosUrl) {
      const missing = coreBios.map(m => m.filename).join(" or ");
      return res.send(
        `cabinetFailLaunchProgress(${JSON.stringify(
          `BIOS required — upload ${missing} in the BIOS tab before playing this system.`
        )});`
      );
    }

    res.send(renderEmulatorBootstrap({
      core, title: rom.title, gameId: `${rom.system}-${rom.slug}`, romId: rom.id, discs, romHash: rom.romHash ?? null,
      raUsername: bootstrapSettings.raUsername ?? "", raToken: bootstrapSettings.raToken ?? "",
      controlDefaults: await (async () => {
        const global = (bootstrapSettings.controlDefaults ?? {}) as Record<string, Record<number, string>>;
        const pId = profileParam ? Number(profileParam) : 1;
        const merged: Record<string, Record<number, string>> = { ...global };
        const profileBindings = await storage.getProfileControlBindings(pId, core);
        if (profileBindings && Object.keys(profileBindings).length > 0) merged[core] = { ...(global[core] ?? {}), ...profileBindings };
        return merged;
      })(),
      gamepadBindings: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        return (await storage.getGamepadBindings(pId, "default")) || {};
      })(),
      controlDefaultsP2: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        return (await storage.getProfileControlBindings(pId, `${core}_p2`)) || {};
      })(),
      gamepadBindingsP2: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
        return (await storage.getGamepadBindings(pId, "default_p2")) || {};
      })(),
      gamepadRumble: bootstrapSettings.gamepadRumble ?? true,
      systemDisplay: (bootstrapSettings.systemDisplay ?? {}) as Record<string, any>,
      globalAspectRatio: bootstrapSettings.globalAspectRatio || "auto",
      globalShader: bootstrapSettings.globalShader || "none",
      userId, userName, profileId: profileParam ?? "1",
      cheats: await storage.listCheats(rom.id, profileParam ? Number(profileParam) : 1).then((cs) => cs.filter((c) => c.enabled)),
      biosUrl,
    }));
    } catch (err: any) {
      console.error("[HomeArcade] bootstrap.js generation error:", err);
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.status(500).send(`cabinetFailLaunchProgress(${JSON.stringify("Server error generating bootstrap: " + (err?.message || "unknown"))});`);
    }
  });

  app.patch("/api/roms/:id/rating", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ rating: z.number().int().min(0).max(5) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Rating must be a whole number from 0 to 5." });
    const updated = await storage.updateUploadedRomRating(id, parsed.data.rating);
    if (!updated) return res.status(404).json({ message: "Uploaded ROM not found." });
    res.json(updated);
  });

  app.patch("/api/roms/:id/favorite", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z.object({ favorite: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Favorite must be true or false." });
    const updated = await storage.updateUploadedRomFavorite(id, parsed.data.favorite);
    if (!updated) return res.status(404).json({ message: "Uploaded ROM not found." });
    res.json(updated);
  });

  app.patch("/api/roms/:id/play-status", async (req, res) => {
    const id = Number(req.params.id);
    const VALID = ["unset", "backlog", "playing", "completed", "dropped"];
    const parsed = z.object({ playStatus: z.string() }).safeParse(req.body);
    if (!parsed.success || !VALID.includes(parsed.data.playStatus)) return res.status(400).json({ message: "Invalid play status." });
    const updated = await storage.updateUploadedRomPlayStatus(id, parsed.data.playStatus);
    if (!updated) return res.status(404).json({ message: "Uploaded ROM not found." });
    res.json(updated);
  });

  app.delete("/api/roms/:id", async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteUploadedRom(id);
    if (!deleted) return res.status(404).json({ message: "Uploaded ROM not found." });
    const safeRoot = `${ROM_ROOT}${path.sep}`;
    const resolved = path.resolve(deleted.filePath);
    let fileRemoved = false;
    if (resolved.startsWith(safeRoot)) {
      try { await fs.unlink(resolved); fileRemoved = true; } catch { fileRemoved = false; }
    }
    res.json({ deleted: true, id: deleted.id, fileRemoved });
  });
}
