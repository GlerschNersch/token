import type { Express } from "express";
import { storage } from "../storage";
import { LIBRETRO_PLAYLISTS } from "./shared";
import { decodeHtml, normalizeSearchTitle, significantTokens, numberTokens } from "./utils";
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
    const updated = await storage.updateCheatEnabled(id, enabled);
    res.json(updated);
  });

  app.delete("/api/cheats/:id", async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteCheat(id);
    res.json({ deleted: true });
  });

  // ── Fetch cheats from Libretro database ───────────────────────────────────────────
  app.get("/api/roms/:id/fetch-cheats", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const folder = LIBRETRO_PLAYLISTS[rom.system];
    if (!folder) return res.json({ cheats: [], message: "No cheat database for this system." });

    try {
      // 1. Get directory index
      let files = await storage.getCheatIndex(folder);
      if (!files) {
        const indexUrl = `https://api.github.com/repos/libretro/libretro-database/contents/cht/${encodeURIComponent(folder)}`;
        const indexRes = await fetch(indexUrl, {
          headers: { "Accept": "application/vnd.github+json", "User-Agent": "CabinetBridge/0.1" }
        });
        if (!indexRes.ok) return res.json({ cheats: [], message: `Libretro index returned ${indexRes.status}.` });
        const raw = await indexRes.json() as { name: string; path: string }[];
        files = raw.filter(f => f.name.endsWith(".cht")).map(f => ({ name: f.name, path: f.path }));
        await storage.setCheatIndex(folder, files);
      }

      // 2. Fuzzy match
      const targetNormalized = normalizeSearchTitle(rom.title);
      const targetTokens = significantTokens(targetNormalized);
      const targetNums = numberTokens(targetTokens);

      const candidates = files.map(f => {
        const fileTitle = f.name.replace(/\.cht$/i, "");
        const baseTitle = fileTitle.replace(/\s*\(.+$/, "");
        const candNormalized = normalizeSearchTitle(baseTitle);
        const candTokens = significantTokens(candNormalized);
        const candNums = numberTokens(candTokens);

        const numMismatch = targetNums.length > 0 && candNums.length > 0 && !targetNums.some(n => candNums.includes(n));
        const overlap = targetTokens.filter(t => candTokens.includes(t));
        
        let score = numMismatch ? 0 : candNormalized === targetNormalized ? 100 : overlap.length >= Math.min(2, targetTokens.length) ? (overlap.length / Math.max(1, targetTokens.length)) * 70 + (overlap.length / Math.max(1, candTokens.length)) * 30 : 0;
        
        if (score > 0) {
          if (/\(USA\)|\(US\)/i.test(f.name)) score += 10;
          if (/\(World\)/i.test(f.name)) score += 5;
        }
        return { ...f, score };
      }).filter(c => c.score >= 50).sort((a, b) => b.score - a.score);

      const best = candidates[0];
      if (!best) return res.json({ cheats: [], message: `No cheat file found for "${rom.title}".` });

      // 3. Download and parse
      let cheats: { desc: string; code: string }[] | null = await storage.getCachedCheats(best.path);
      if (!cheats) {
        const rawUrl = `https://raw.githubusercontent.com/libretro/libretro-database/master/${best.path}`;
        const rawRes = await fetch(rawUrl);
        if (!rawRes.ok) return res.json({ cheats: [], message: "Failed to download cheat file." });
        const text = await rawRes.text();
        
        cheats = [];
        const blocks = text.split(/cheat\d+_desc\s*=/i).slice(1);
        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          const desc = lines[0].replace(/^"|"$/g, "").trim();
          const codeMatch = block.match(/cheat\d+_code\s*=\s*"([^"]+)"/i) || block.match(/cheat\d+_code\s*=\s*([^\s]+)/i);
          if (desc && codeMatch) {
            cheats.push({ desc, code: codeMatch[1].trim() });
          }
        }
        await storage.setCachedCheats(best.path, cheats);
      }

      res.json({ cheats, message: `Loaded from ${best.name}` });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Cheat fetch failed." });
    }
  });
}
