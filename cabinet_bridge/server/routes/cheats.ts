import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";

export function registerCheatRoutes(app: Express) {
  app.get("/api/roms/:id/cheats", async (req, res) => {
    const romId = Number(req.params.id);
    const profileId = Number(req.query.profileId) || 1;
    const cheats = await storage.listCheats(romId, profileId);
    res.json(cheats);
  });

  app.post("/api/roms/:id/cheats", async (req, res) => {
    const romId = Number(req.params.id);
    const { description, code, profileId } = req.body;
    if (!description || !code) return res.status(400).json({ message: "Description and code required." });
    try {
      const created = await storage.createCheat({ romId, profileId: profileId || 1, description, code, enabled: true });
      res.json(created);
    } catch {
      res.status(409).json({ message: "Cheat already exists." });
    }
  });

  app.patch("/api/cheats/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ message: "Enabled must be boolean." });
    const updated = await storage.updateCheat(id, enabled);
    res.json(updated);
  });

  app.delete("/api/cheats/:id", async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteCheat(id);
    res.json({ deleted: true });
  });
}
