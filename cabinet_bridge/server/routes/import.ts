import { Express } from "express";
import express from "express";
import { storage } from "../storage";

function decodeXMLEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function registerImportRoutes(app: Express) {
  // ── EmulationStation gamelist.xml import ──────────────────────────────────
  app.post("/api/import/emulationstation", express.raw({ limit: "50mb", type: ["text/xml", "application/xml", "application/octet-stream", "text/plain"] }), async (req, res) => {
    try {
      const xml = req.body.toString("utf8");
      const gameBlocks = [...xml.matchAll(/<game[^>]*>([\s\S]*?)<\/game>/gi)];
      const roms = await storage.listUploadedRoms();
      const results: { title: string; updated: boolean; reason?: string }[] = [];

      for (const block of gameBlocks) {
        const inner = block[1];
        const get = (tag: string) => {
          const m = inner.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i"));
          return m ? decodeXMLEntities(m[1]) : null;
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

        const meta: Record<string, any> = {};
        const desc = get("desc");
        const date = get("releasedate");
        const dev = get("developer");
        const pub = get("publisher");
        const genre = get("genre");
        const players = get("players");
        const image = get("image");
        const rating = get("rating");
        const playcount = get("playcount");
        const lastplayed = get("lastplayed");

        if (desc) meta.description = desc.slice(0, 2000);
        if (date) { const y = Number(date.slice(0, 4)); if (y >= 1970 && y <= 2030) meta.releaseYear = y; }
        if (dev) meta.developer = dev.slice(0, 256);
        if (pub) meta.publisher = pub.slice(0, 256);
        if (genre) meta.genre = genre.slice(0, 256);
        if (players) meta.players = players.slice(0, 16);
        if (image && image.startsWith("http")) meta.artUrl = image;
        if (rating) { const r = parseFloat(rating); if (!isNaN(r)) meta.rating = Math.round(r * 5); } // ES rating is 0..1, our app is 0..5
        if (playcount) { const pc = parseInt(playcount, 10); if (!isNaN(pc)) meta.playCount = pc; }
        if (lastplayed) { 
          // ES lastplayed is usually YYYYMMDDTHHMMSS
          const y = parseInt(lastplayed.slice(0, 4), 10);
          const m = parseInt(lastplayed.slice(4, 6), 10) - 1;
          const d = parseInt(lastplayed.slice(6, 8), 10);
          const ts = new Date(y, m, d).getTime();
          if (!isNaN(ts)) meta.lastPlayed = ts;
        }

        if (Object.keys(meta).length > 0) {
          if (meta.artUrl || meta.description || meta.developer || meta.publisher || meta.genre) {
            meta.scrapeStatus = "matched";
          }
          await storage.updateUploadedRomMetadata(match.id, meta);
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
      const gameBlocks = [...xml.matchAll(/<Game>([\s\S]*?)<\/Game>/gi)];
      const roms = await storage.listUploadedRoms();
      const results: { title: string; updated: boolean; reason?: string }[] = [];

      for (const block of gameBlocks) {
        const inner = block[1];
        const get = (tag: string) => {
          const m = inner.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, "i"));
          return m ? decodeXMLEntities(m[1]) : null;
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

        const meta: Record<string, any> = {};
        const overview = get("Notes") ?? get("Overview");
        const releaseDate = get("ReleaseDate");
        const developer = get("Developer");
        const publisher = get("Publisher");
        const genre = get("Genre") ?? get("Genres");
        const maxPlayers = get("MaxPlayers");
        const starRating = get("StarRating");
        const playCount = get("PlayCount");

        if (overview) meta.description = overview.slice(0, 2000);
        if (releaseDate) {
          const y = Number(releaseDate.slice(0, 4));
          if (y >= 1970 && y <= 2030) meta.releaseYear = y;
        }
        if (developer) meta.developer = developer.slice(0, 256);
        if (publisher) meta.publisher = publisher.slice(0, 256);
        if (genre) meta.genre = genre.split(";")[0].trim().slice(0, 256);
        if (maxPlayers) meta.players = maxPlayers.trim().slice(0, 16);
        if (starRating) { const r = parseFloat(starRating); if (!isNaN(r)) meta.rating = Math.round(r); }
        if (playCount) { const pc = parseInt(playCount, 10); if (!isNaN(pc)) meta.playCount = pc; }

        if (Object.keys(meta).length > 0) {
          if (meta.description || meta.developer || meta.publisher || meta.genre) {
            meta.scrapeStatus = "matched";
          }
          await storage.updateUploadedRomMetadata(match.id, meta);
        }
        results.push({ title: match.title, updated: true });
      }
      res.json({ imported: results.filter((r) => r.updated).length, skipped: results.filter((r) => !r.updated).length, results });
    } catch (err) {
      res.status(400).json({ message: String(err) });
    }
  });
}
