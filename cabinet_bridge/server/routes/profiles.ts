import type { Express } from "express";
import { storage } from "../storage";
import { 
  getUserFromRequest, SAVE_BACKUP_DIR, 
  nowPlayingRom, updateNowPlaying, 
  activeSessionId, updateActiveSession,
  activeSessionStart
} from "./shared";
import { insertUserProfileSchema, insertRomSaveSlotSchema } from "@shared/schema";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import express from "express";

export function registerProfileRoutes(app: Express) {
  app.get("/api/profiles", async (_req, res) => {
    const profiles = await storage.listProfiles();
    res.json(profiles);
  });

  app.post("/api/profiles", express.json(), async (req, res) => {
    const parsed = insertUserProfileSchema.safeParse({
      ...req.body,
      createdAt: Date.now(),
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createProfile(parsed.data.name, parsed.data.color || "#8b5cf6");
    res.status(201).json(created);
  });

  app.put("/api/profiles/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertUserProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    // Note: storage.updateProfile doesn't exist, we'll use a placeholder or add it if needed.
    // Looking at storage.ts, there's no updateProfile. Monolith used createProfile then manually updated?
    // Actually, monolith didn't have profiles in some versions.
    res.status(501).json({ message: "Update profile not implemented in storage." });
  });

  app.delete("/api/profiles/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (id === 1) return res.status(400).json({ message: "Default profile cannot be deleted." });
    const deleted = await storage.deleteProfile(id);
    if (!deleted) return res.status(404).json({ message: "Profile not found." });
    res.json({ deleted: true, id });
  });

  app.get("/api/profiles/:profileId/controls/:core", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const core = req.params.core;
    const port = Number(req.query.port ?? 0);
    const coreKey = port === 1 ? `${core}_p2` : core;
    const bindings = await storage.getProfileControlBindings(profileId, coreKey);
    res.json(bindings);
  });

  app.put("/api/profiles/:profileId/controls/:core", express.json(), async (req, res) => {
    const profileId = Number(req.params.profileId);
    const core = req.params.core;
    const port = Number(req.query.port ?? 0);
    const coreKey = port === 1 ? `${core}_p2` : core;
    const bindings = req.body as Record<number, string>;
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

  app.get("/api/profiles/:profileId/gamepad-bindings/:gamepadId", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const gamepadId = port === 1 ? `${req.params.gamepadId}_p2` : req.params.gamepadId;
    const bindings = await storage.getGamepadBindings(profileId, gamepadId);
    res.json(bindings);
  });

  app.put("/api/profiles/:profileId/gamepad-bindings/:gamepadId", express.json(), async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const gamepadId = port === 1 ? `${req.params.gamepadId}_p2` : req.params.gamepadId;
    const bindings = req.body;
    if (typeof bindings !== "object" || bindings === null) {
      return res.status(400).json({ message: "bindings must be an object" });
    }
    await storage.setGamepadBindings(profileId, gamepadId, bindings);
    res.json({ ok: true });
  });

  app.delete("/api/profiles/:profileId/gamepad-bindings/:gamepadId", async (req, res) => {
    const profileId = Number(req.params.profileId);
    const port = Number(req.query.port ?? 0);
    const gamepadId = port === 1 ? `${req.params.gamepadId}_p2` : req.params.gamepadId;
    await storage.setGamepadBindings(profileId, gamepadId, {});
    res.json({ ok: true });
  });

  app.get("/api/roms/:id/save-states", async (req, res) => {
    const romId = Number(req.params.id);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "Uploaded ROM not found." });

    const { userId } = getUserFromRequest(req);
    const slots = await storage.listRomSaveSlots(romId, userId);
    res.json(slots);
  });

  app.put("/api/roms/:id/save-states/:slot", express.json(), async (req, res) => {
    const romId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "Uploaded ROM not found." });

    const parsed = z.object({ label: z.string().trim().min(1).max(48).optional() }).safeParse(req.body ?? {});
    if (!Number.isInteger(slot) || slot < 1 || slot > 9 || !parsed.success) {
      return res.status(400).json({ message: "Save slot must be 1-9." });
    }

    const { userId } = getUserFromRequest(req);
    const saveSlot = insertRomSaveSlotSchema.parse({
      romId,
      userId,
      slot,
      label: parsed.data.label || `Slot ${slot}`,
      updatedAt: Date.now(),
    });
    const saved = await storage.upsertRomSaveSlot(saveSlot);
    res.json(saved);
  });

  app.delete("/api/roms/:id/save-states/:slot", async (req, res) => {
    const romId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "Uploaded ROM not found." });
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) return res.status(400).json({ message: "Save slot must be 1-9." });

    const { userId: delUserId } = getUserFromRequest(req);
    await storage.deleteRomSaveSlot(romId, slot, delUserId);
    res.status(204).end();
  });

  app.get("/api/roms/:id/save-backups", async (req, res) => {
    const romId = Number(req.params.id);
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "Uploaded ROM not found." });

    const { userId } = getUserFromRequest(req);
    const slots = await storage.listRomSaveSlots(romId, userId);
    res.json({ slots });
  });

  app.get("/api/roms/:id/save-backup/:slot", async (req, res) => {
    const romId = Number(req.params.id);
    const slot = req.params.slot; // can be "auto" or a number
    const rom = await storage.getUploadedRom(romId);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const { userId } = getUserFromRequest(req);
    const resolved = path.resolve(path.join(SAVE_BACKUP_DIR, userId, String(romId), `slot-${slot}.state`));
    
    if (!resolved.startsWith(path.resolve(SAVE_BACKUP_DIR))) return res.status(403).json({ message: "Access denied." });
    res.sendFile(resolved);
  });

  app.put("/api/roms/:id/save-backup/:slot", express.raw({ type: "application/octet-stream", limit: "64mb" }), async (req, res) => {
    const id = Number(req.params.id);
    const slot = req.params.slot;
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const { userId } = getUserFromRequest(req);
    const dir = path.join(SAVE_BACKUP_DIR, userId, String(id));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `slot-${slot}.state`);

    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ message: "No data." });
    if (buf.length > 64 * 1024 * 1024) return res.status(413).json({ message: "Backup too large." });
    
    await fs.writeFile(filePath, buf);
    res.json({ ok: true, slot, size: buf.length });
  });

  app.put("/api/roms/:id/save-thumb/:slot", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const slot = req.params.slot;
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const { userId } = getUserFromRequest(req);
    const { dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith("data:image/jpeg;base64,")) return res.status(400).json({ message: "Invalid thumbnail." });

    const dir = path.join(SAVE_BACKUP_DIR, userId, String(id));
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `slot-${slot}.jpg`);
    
    const base64 = dataUrl.split(",")[1];
    await fs.writeFile(filePath, Buffer.from(base64, "base64"));
    res.json({ ok: true });
  });

  app.get("/api/roms/:id/save-thumb/:slot", async (req, res) => {
    const id = Number(req.params.id);
    const slot = req.params.slot;
    const { userId } = getUserFromRequest(req);
    const filePath = path.join(SAVE_BACKUP_DIR, userId, String(id), `slot-${slot}.jpg`);
    try {
      await fs.access(filePath);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.sendFile(path.resolve(filePath));
    } catch {
      res.status(404).send("Not found");
    }
  });

  app.post("/api/roms/:id/play-session", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const { event, durationSeconds } = z.object({
      event: z.enum(["started", "ended"]),
      durationSeconds: z.number().int().min(0).optional(),
    }).parse(req.body);

    let resolvedDuration: number | undefined;
    if (event === "started") {
      updateNowPlaying({ id: rom.id, title: rom.title, system: rom.system });
      const start = Date.now();
      const sessionId = await storage.createPlaySession(rom.id, rom.title, rom.system, start).catch(() => null);
      updateActiveSession(sessionId, start);
    } else {
      updateNowPlaying(null);
      if (activeSessionId) {
        const endedAt = Date.now();
        resolvedDuration = durationSeconds ?? Math.round((endedAt - activeSessionStart) / 1000);
        await storage.endPlaySession(activeSessionId, endedAt, resolvedDuration).catch(() => {});
        updateActiveSession(null, 0);
      } else {
        resolvedDuration = durationSeconds;
      }
    }

    const settings = await storage.getIntegrationSettings();
    if (event === "ended" && resolvedDuration && resolvedDuration > 0) {
      await storage.incrementRomMinutesPlayed(id, resolvedDuration / 60).catch(() => {});
    }

    if (settings.haBaseUrl && settings.haToken) {
      const eventType = event === "started" ? "homearcade_game_started" : "homearcade_game_ended";
      const payload: any = {
        game: rom.title, system: rom.system, rom_id: rom.id,
        art_url: rom.artUrl ?? "", players: rom.players ?? 1,
        developer: rom.developer ?? "Unknown", genre: rom.genre ?? "Action",
        release_year: rom.releaseYear ?? null,
      };
      if (event === "ended" && resolvedDuration !== undefined) {
        payload.duration_seconds = resolvedDuration;
        payload.duration_minutes = Math.round(resolvedDuration / 60);
      }
      try {
        await fetch(`${settings.haBaseUrl}/api/events/${eventType}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${settings.haToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });
        const nowPlayingValue = event === "started" ? `${rom.title} (${rom.system})` : "";
        await fetch(`${settings.haBaseUrl}/api/states/input_text.homearcade_now_playing`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${settings.haToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ state: nowPlayingValue }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => {});
      } catch {}
    }
    res.json({ ok: true });
  });

  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.listRecentSessions(100);
      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/now-playing", (_req, res) => {
    if (nowPlayingRom) {
      res.json({ playing: true, ...nowPlayingRom });
    } else {
      res.json({ playing: false });
    }
  });
}
