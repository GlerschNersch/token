import { Express } from "express";
import { storage } from "../storage";
import { LIBRETRO_PLAYLISTS, SYSTEM_IMAGE_FETCH_HEADERS } from "./shared";
import { decodeHtml, normalizeSearchTitle, normalizeTitle, numberTokens, significantTokens } from "./utils";

// ── TheGamesDB ────────────────────────────────────────────────────────────────
const TGDB_PLATFORM_IDS: Record<string, number> = {
  nes: 7, snes: 6, n64: 3, gba: 5, genesis: 36, ps1: 10, ps2: 11,
  arcade: 23, dreamcast: 16, gb: 4, gbc: 41, nds: 8, psp: 13,
  atari2600: 22, saturn: 17, gamegear: 35, sms: 35, pce: 34,
  sega32x: 33, segacd: 21, neogeo: 24, virtualboy: 79, atari7800: 8051, lynx: 4924,
};

interface TGDBMeta {
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

export async function fetchTheGamesDBMeta(system: string, title: string, apiKey: string): Promise<TGDBMeta | null> {
  if (!apiKey) return null;
  const platformId = TGDB_PLATFORM_IDS[system];
  if (!platformId) return null;

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      name: title,
      fields: "overview,genres,developers,publishers,players,rating",
      include: "boxart",
      "filter[platform]": String(platformId),
    });
    const res = await fetch(`https://api.thegamesdb.net/v1/Games/ByGameName?${params}`, {
      headers: { "User-Agent": "CabinetBridge/0.6" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, any>;

    const games = (json?.data as any)?.games as Array<any> | undefined;
    if (!Array.isArray(games) || games.length === 0) return null;

    const titleLower = title.toLowerCase();
    const game = games.find((g) => String(g.game_title ?? "").toLowerCase() === titleLower) ?? games[0];

    const description = String(game.overview ?? "").trim() || null;
    const players = game.players ? String(game.players) : null;

    let releaseYear: number | null = null;
    const relDate = game.release_date as string | undefined;
    if (relDate) {
      const y = parseInt(relDate.slice(0, 4), 10);
      if (!isNaN(y)) releaseYear = y;
    }

    const include = json?.include as any;
    const genresMap = (include?.genres as any)?.data as Record<string, { name?: string }> | undefined;
    const gameGenreIds = game.genres as number[] | undefined;
    let genre: string | null = null;
    if (genresMap && Array.isArray(gameGenreIds)) {
      genre = gameGenreIds.slice(0, 2).map((id) => genresMap[id]?.name).filter(Boolean).join(", ") || null;
    }

    const devsMap = (include?.developers as any)?.data as Record<string, { name?: string }> | undefined;
    const devIds = game.developers as number[] | undefined;
    let developer: string | null = null;
    if (devsMap && Array.isArray(devIds) && devIds.length > 0) {
      developer = devsMap[devIds[0]]?.name ?? null;
    }

    const pubsMap = (include?.publishers as any)?.data as Record<string, { name?: string }> | undefined;
    const pubIds = game.publishers as number[] | undefined;
    let publisher: string | null = null;
    if (pubsMap && Array.isArray(pubIds) && pubIds.length > 0) {
      publisher = pubsMap[pubIds[0]]?.name ?? null;
    }

    let artUrl: string | null = null;
    const boxartData = (include?.boxart as any)?.data as Record<string, Array<{ side?: string; filename?: string }>> | undefined;
    const baseUrl = ((include?.boxart as any)?.base_url as Record<string, string>)?.original ?? "https://cdn.thegamesdb.net/images/original/";
    const gameId = String(game.id ?? "");
    const artList = boxartData?.[gameId];
    if (Array.isArray(artList)) {
      const front = artList.find((a) => a.side === "front") ?? artList[0];
      if (front?.filename) artUrl = baseUrl + front.filename;
    }

    return {
      artUrl, description, releaseYear, developer, publisher, genre, players,
      scrapeStatus: "matched",
      scrapeMessage: "Metadata from TheGamesDB",
    };
  } catch { return null; }
}

// ── ScreenScraper ─────────────────────────────────────────────────────────────
const SCREENSCRAPER_SYSTEM_IDS: Record<string, number> = {
  nes: 3, snes: 4, n64: 14, gba: 12, genesis: 1, ps1: 57, ps2: 58,
  arcade: 75, dreamcast: 23, gb: 9, gbc: 10, nds: 15, psp: 61,
  atari2600: 26, saturn: 22, gamegear: 21, sms: 2, pce: 31,
  sega32x: 19, segacd: 20, neogeo: 142, virtualboy: 11, atari7800: 41, lynx: 28,
};

export interface ScreenScraperMeta {
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

export async function fetchScreenScraperMeta(
  system: string, romFileName: string, title: string, ssUserId: string, ssPassword: string,
): Promise<ScreenScraperMeta | null> {
  const systemId = SCREENSCRAPER_SYSTEM_IDS[system];
  if (!systemId) return null;

  const params = new URLSearchParams({
    devid: "cabinet_bridge", devpassword: "cabinet_bridge", softname: "cabinet_bridge",
    output: "json", systemeid: String(systemId), romtype: "rom", romfilename: romFileName,
  });
  if (ssUserId) params.set("ssid", ssUserId);
  if (ssPassword) params.set("sspassword", ssPassword);

  try {
    const res = await fetch(`https://www.screenscraper.fr/api2/jeuInfos.php?${params}`, {
      headers: { "User-Agent": "CabinetBridge/0.1" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json() as any;
    const jeu = (json?.response as any)?.jeu as any;
    if (!jeu) return null;

    let description: string | null = null;
    const synopses = jeu.synopsis as Array<{ langue: string; text: string }> | undefined;
    if (Array.isArray(synopses)) {
      const en = synopses.find((s) => s.langue === "en");
      description = (en ?? synopses[0])?.text ?? null;
    }

    let releaseYear: number | null = null;
    const dates = jeu.dates as Array<{ region: string; text: string }> | undefined;
    if (Array.isArray(dates)) {
      const preferred = dates.find((d) => ["wor", "us", "eu"].includes(d.region)) ?? dates[0];
      const y = preferred?.text ? parseInt(preferred.text.slice(0, 4), 10) : NaN;
      if (!isNaN(y)) releaseYear = y;
    }

    const developer = (jeu.developpeur as any)?.text ?? null;
    const publisher = (jeu.editeur as any)?.text ?? null;

    let genre: string | null = null;
    const genres = jeu.genres as Array<{ noms: Array<{ langue: string; text: string }> }> | undefined;
    if (Array.isArray(genres) && genres.length > 0) {
      const names = genres.map((g) => {
        const en = (g.noms ?? []).find((n) => n.langue === "en");
        return (en ?? g.noms?.[0])?.text;
      }).filter(Boolean) as string[];
      genre = names.slice(0, 2).join(", ") || null;
    }

    const players = (jeu.joueurs as any)?.text ?? null;

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
      const wheelTypes = ["wheel-hd", "wheel", "wheel-carbon"];
      for (const wt of wheelTypes) {
        const w = medias.find((m) => m.type === wt);
        if (w?.url) { wheelArtUrl = w.url; break; }
      }
      const videoTypes = ["video-normalized", "video"];
      for (const vt of videoTypes) {
        const v = medias.find((m) => m.type === vt);
        if (v?.url) { videoUrl = v.url; break; }
      }
    }

    let communityScore: number | null = null;
    const noteRaw = (jeu.note as any)?.text;
    if (noteRaw) {
      const parsed = parseFloat(noteRaw);
      if (!isNaN(parsed)) communityScore = parsed;
    }

    return {
      artUrl, wheelArtUrl, videoUrl, communityScore, description, releaseYear, developer, publisher, genre, players,
      scrapeStatus: "matched", scrapeMessage: "Metadata from ScreenScraper.fr",
    };
  } catch { return null; }
}

export async function findLibretroBoxArt(system: string, title: string) {
  const playlist = LIBRETRO_PLAYLISTS[system];
  if (!playlist) return { url: null, message: "No Libretro thumbnail playlist configured." };

  const directoryUrl = `https://thumbnails.libretro.com/${encodeURIComponent(playlist)}/Named_Boxarts/`;
  try {
    const response = await fetch(directoryUrl, { headers: { "User-Agent": "CabinetBridge/0.1" } });
    if (!response.ok) return { url: null, message: `Libretro index returned ${response.status}.` };
    const html = await response.text();
    const hrefs = Array.from(html.matchAll(/href="([^"]+\.png)"/gi)).map((m) => decodeHtml(m[1]));
    const normalizedTitle = normalizeSearchTitle(title);
    const targetTokens = significantTokens(normalizedTitle);
    
    const candidates = hrefs.map((href) => {
      const decoded = decodeURIComponent(href);
      const fileTitle = decoded.replace(/\.png$/i, "");
      const baseTitle = fileTitle.replace(/\s*\(.+$/, "");
      const normalizedFile = normalizeTitle(fileTitle);
      const normalizedBase = normalizeSearchTitle(baseTitle);
      const candidateTokens = significantTokens(normalizedBase);
      const targetNumbers = numberTokens(targetTokens);
      const candidateNumbers = numberTokens(candidateTokens);
      const numberMismatch = targetNumbers.length > 0 && candidateNumbers.length > 0 && !targetNumbers.some(t => candidateNumbers.includes(t));
      const overlap = targetTokens.filter(t => candidateTokens.includes(t));
      const textScore = numberMismatch ? 0 : normalizedBase === normalizedTitle ? 100 : normalizedFile.startsWith(normalizedTitle) ? 82 : overlap.length >= Math.min(2, targetTokens.length) ? (overlap.length/Math.max(1,targetTokens.length))*65 + (overlap.length/Math.max(1,candidateTokens.length))*25 : 0;
      let score = score = textScore;
      if (score > 0) {
        if (/\(USA\)|\(US\)/i.test(decoded)) score += 20;
        if (/\(World\)/i.test(decoded)) score += 12;
        if (/\(Europe\)/i.test(decoded)) score += 8;
        if (/\[h|\[b|\[tr|\[p|prototype|sample/i.test(decoded)) score -= 40;
        if (normalizedBase !== normalizedTitle && normalizedBase.startsWith(normalizedTitle)) score -= 20;
      }
      return { href, decoded, score };
    }).filter(c => c.score >= 55).sort((a,b) => b.score - a.score || a.decoded.length - b.decoded.length);

    const best = candidates[0];
    if (!best) return { url: null, message: `No Libretro box art match found for "${title}".` };
    return { url: `${directoryUrl}${best.href}`, message: `Matched Libretro Named_Boxarts: ${best.decoded}` };
  } catch (err) {
    return { url: null, message: err instanceof Error ? err.message : "Artwork scrape failed." };
  }
}

export function registerScrapeRoutes(app: Express) {
  app.post("/api/roms/:id/scrape-art", async (req, res) => {
    const id = Number(req.params.id);
    const rom = await storage.getUploadedRom(id);
    if (!rom) return res.status(404).json({ message: "ROM not found." });

    const settings = await storage.getIntegrationSettings();
    let meta: any = null;

    // Try ScreenScraper first
    if (settings.screenScraperEnabled && settings.screenScraperUser && settings.screenScraperPassword) {
      meta = await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.screenScraperUser, settings.screenScraperPassword);
    }
    // Try TheGamesDB second
    if (!meta && settings.theGamesDbEnabled && settings.theGamesDbApiKey) {
      meta = await fetchTheGamesDBMeta(rom.system, rom.title, settings.theGamesDbApiKey);
    }
    // Fallback to Libretro
    if (!meta) {
      const libretro = await findLibretroBoxArt(rom.system, rom.title);
      if (libretro.url) {
        meta = { artUrl: libretro.url, scrapeStatus: "matched", scrapeMessage: libretro.message };
      } else {
        await storage.updateUploadedRomArt(id, { artUrl: null, scrapeStatus: "failed", scrapeMessage: libretro.message });
        return res.json({ success: false, message: libretro.message });
      }
    }

    if (meta) {
      const updated = await storage.updateUploadedRomMetadata(id, meta);
      return res.json({ success: true, rom: updated });
    }
    res.json({ success: false, message: "No match found." });
  });

  app.post("/api/roms/scrape-all", async (req, res) => {
    const roms = await storage.listUploadedRoms();
    const unscraped = roms.filter((r) => r.scrapeStatus === "not_scraped" || r.scrapeStatus === "failed");
    if (unscraped.length === 0) return res.json({ message: "All ROMs already scraped." });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ type: "start", total: unscraped.length });

    const settings = await storage.getIntegrationSettings();
    let count = 0;

    for (const rom of unscraped) {
      count++;
      send({ type: "progress", current: count, total: unscraped.length, title: rom.title });

      let meta: any = null;
      if (settings.screenScraperEnabled && settings.screenScraperUser && settings.screenScraperPassword) {
        meta = await fetchScreenScraperMeta(rom.system, rom.fileName, rom.title, settings.screenScraperUser, settings.screenScraperPassword);
      }
      if (!meta && settings.theGamesDbEnabled && settings.theGamesDbApiKey) {
        meta = await fetchTheGamesDBMeta(rom.system, rom.title, settings.theGamesDbApiKey);
      }
      if (!meta) {
        const libretro = await findLibretroBoxArt(rom.system, rom.title);
        if (libretro.url) meta = { artUrl: libretro.url, scrapeStatus: "matched", scrapeMessage: libretro.message };
      }

      if (meta) {
        await storage.updateUploadedRomMetadata(rom.id, meta);
        send({ type: "result", id: rom.id, title: rom.title, status: "success" });
      } else {
        await storage.updateUploadedRomArt(rom.id, { artUrl: null, scrapeStatus: "failed", scrapeMessage: "No match found during bulk scrape." });
        send({ type: "result", id: rom.id, title: rom.title, status: "failed" });
      }
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    send({ type: "complete" });
    res.end();
  });
}
