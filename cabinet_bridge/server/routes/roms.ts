import type { Express } from "express";
import express from "express";
import { storage } from "../storage";
import { 
  ROM_EXTENSIONS, MAX_UPLOAD_MB, MAX_UPLOAD_BYTES, 
  EMULATORJS_CORES, ROM_ROOT, getUserFromRequest 
} from "./shared";
import { renderEmulatorPage, renderEmulatorBootstrap, renderPlayerError } from "./player";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { z } from "zod";
import { insertUploadedRomSchema } from "@shared/schema";
import { extractFirstRomFromZip, titleFromFileName, slugify } from "./utils";
import { fetchTheGamesDBMeta, fetchScreenScraperMeta, findLibretroBoxArt } from "./scrape";

export function registerRomRoutes(app: Express) {
  app.get("/api/upload-limits", (_req, res) => {
    res.json({
      maxUploadMb: MAX_UPLOAD_MB,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      allowedExtensions: ROM_EXTENSIONS,
    });
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
      const tgdbMeta = await fetchTheGamesDBMeta(system, title, settings.theGamesDbApiKey ?? "");
      const ssMeta = tgdbMeta?.artUrl ? null : await fetchScreenScraperMeta(system, safeName, title, settings.screenScraperUser || "", settings.screenScraperPassword || "");
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

  app.get("/api/emulatorjs/*path", async (req, res) => {
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
      res.setHeader("Cache-Control", "public, max-age=604800");
      const { Readable } = await import("stream");
      Readable.fromWeb(upstream.body as any).pipe(res);
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
    res.send(renderEmulatorBootstrap({
      core, title: rom.title, gameId: `${rom.system}-${rom.slug}`, romId: rom.id, discs, romHash: rom.romHash ?? null,
      raUsername: bootstrapSettings.raUsername ?? "", raToken: bootstrapSettings.raToken ?? "",
      controlDefaults: await (async () => {
        const global = (bootstrapSettings.controlDefaults ?? {}) as Record<string, Record<number, string>>;
        const pId = profileParam ? Number(profileParam) : 1;
        const merged: Record<string, Record<number, string>> = { ...global };
        const profileBindings = await storage.getProfileControlBindings(pId, core);
        if (Object.keys(profileBindings).length > 0) merged[core] = { ...(global[core] ?? {}), ...profileBindings };
        return merged;
      })(),
      gamepadBindings: await (async () => {
        const pId = profileParam ? Number(profileParam) : 1;
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
      systemDisplay: (bootstrapSettings.systemDisplay ?? {}) as Record<string, any>,
      userId, userName, profileId: profileParam ?? "1",
      cheats: await storage.listCheats(rom.id, profileParam ? Number(profileParam) : 1).then((cs) => cs.filter((c) => c.enabled)),
    }));
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
