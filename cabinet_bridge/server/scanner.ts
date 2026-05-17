/**
 * scanner.ts
 *
 * Enhanced ROM scanner — v2
 *
 * Features:
 *   1. Recursive subdirectory scanning  — walks nested folders depth-first
 *   2. Multiple watch paths             — comma-separated CABINET_ROM_WATCH_DIR
 *                                         OR paths stored in integration settings
 *   3. SMB/NAS mount support            — nasWatchPaths stored in DB settings,
 *                                         editable from the Settings UI
 *   4. Per-system folder auto-detect    — infers system from subfolder name
 *                                         (e.g. /roms/nes/ → "nes"),
 *                                         falling back to extension map
 *
 * Polls every 60 seconds. New files are inserted with:
 *   - system = folder-name match (FOLDER_TO_SYSTEM) → extension match (EXT_TO_SYSTEM) → "arcade"
 *   - scrape_status = "not_scraped" (normal scrape pipeline picks them up)
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Lookup tables
// ─────────────────────────────────────────────────────────────────────────────

/** Maps lowercase file extension → system ID */
const EXT_TO_SYSTEM: Record<string, string> = {
  ".nes":  "nes",
  ".smc":  "snes",  ".sfc":  "snes",
  ".md":   "genesis", ".gen": "genesis", ".bin": "genesis",
  ".z64":  "n64",  ".n64":  "n64",  ".v64":  "n64",
  ".gb":   "gb",
  ".gbc":  "gbc",
  ".gba":  "gba",
  ".nds":  "nds",
  ".3ds":  "3ds",
  ".cue":  "ps1",  ".img":  "ps1",  ".chd": "ps1",
  ".iso":  "ps2",
  ".cso":  "psp",  ".pbp":  "psp",
  ".gdi":  "dreamcast", ".cdi": "dreamcast",
  ".zip":  "arcade", ".rom":  "arcade",
  ".7z":   "arcade",
  ".a26":  "atari2600",
  ".a52":  "atari5200",
  ".lnx":  "lynx",
  ".pce":  "pcengine",
  ".ngp":  "ngp",  ".ngc":  "ngp",
  ".ws":   "wonderswan", ".wsc": "wonderswan",
};

/**
 * Maps normalised folder names → system IDs.
 * Checked BEFORE extension — if the ROM lives in /roms/snes/ the folder wins.
 * Normalisation: lowercase, strip non-alphanumeric.
 */
const FOLDER_TO_SYSTEM: Record<string, string> = {
  // Nintendo
  "nes":         "nes",
  "famicom":     "nes",
  "snes":        "snes",
  "supernintendo":"snes",
  "n64":         "n64",
  "nintendo64":  "n64",
  "gb":          "gb",
  "gameboy":     "gb",
  "gbc":         "gbc",
  "gameboycolor":"gbc",
  "gba":         "gba",
  "gameboyadvance":"gba",
  "nds":         "nds",
  "ds":          "nds",
  "nintendods":  "nds",
  "3ds":         "3ds",
  "gamecube":    "gamecube",
  "gc":          "gamecube",
  "wii":         "wii",
  // Sony
  "ps1":         "ps1",
  "psx":         "ps1",
  "playstation":  "ps1",
  "ps2":         "ps2",
  "playstation2": "ps2",
  "psp":         "psp",
  // Sega
  "genesis":     "genesis",
  "megadrive":   "genesis",
  "mastersystem":"mastersystem",
  "sms":         "mastersystem",
  "gamegear":    "gamegear",
  "gg":          "gamegear",
  "32x":         "32x",
  "saturn":      "saturn",
  "dreamcast":   "dreamcast",
  "dc":          "dreamcast",
  // Atari
  "atari2600":   "atari2600",
  "2600":        "atari2600",
  "atari5200":   "atari5200",
  "5200":        "atari5200",
  "atari7800":   "atari7800",
  "7800":        "atari7800",
  "lynx":        "lynx",
  // SNK
  "neogeo":      "neogeo",
  "neo":         "neogeo",
  "ngp":         "ngp",
  "neogeopocket":"ngp",
  // Misc
  "arcade":      "arcade",
  "mame":        "arcade",
  "fba":         "arcade",
  "fbneo":       "arcade",
  "pcengine":    "pcengine",
  "tg16":        "pcengine",
  "turbografx":  "pcengine",
  "wonderswan":  "wonderswan",
  "ws":          "wonderswan",
  "c64":         "c64",
  "commodore64": "c64",
  "amiga":       "amiga",
  "dos":         "dos",
  "pc88":        "pc88",
  "scummvm":     "scummvm",
};

const ROM_EXTENSIONS = new Set(Object.keys(EXT_TO_SYSTEM));

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScannerStatus {
  enabled: boolean;
  /** Comma-separated list of all active watch paths (env + settings). */
  watchDir: string | null;
  watchPaths: string[];
  lastScanAt: number | null;
  lastScanFound: number;
  totalScanned: number;
  watching: boolean;
  error: string | null;
  /** Per-path stats from the last scan run. */
  pathStats: Record<string, { found: number; error: string | null }>;
}

type AddRomFn = (rom: {
  title: string; system: string; slug: string;
  originalName: string; fileName: string; filePath: string;
  size: number; mimeType: string; createdAt: number;
}) => Promise<unknown>;

type ListFilenamesFn = () => Promise<string[]>;
/** Returns the current list of NAS/extra watch paths from the DB settings. */
type GetNasPathsFn = () => Promise<string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;
const MAX_DEPTH = 8; // guard against symlink loops

let _envPaths: string[]        = [];   // from CABINET_ROM_WATCH_DIR env var
let _addRom: AddRomFn | null   = null;
let _listFilenames: ListFilenamesFn | null = null;
let _getNasPaths: GetNasPathsFn | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

let _status: ScannerStatus = {
  enabled:       false,
  watchDir:      null,
  watchPaths:    [],
  lastScanAt:    null,
  lastScanFound: 0,
  totalScanned:  0,
  watching:      false,
  error:         null,
  pathStats:     {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a folder name for FOLDER_TO_SYSTEM lookup. */
function normaliseFolder(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Infer system from the closest matching ancestor folder name, then fall back
 * to the file extension.
 *
 * @param filePath  Absolute path to the ROM file.
 * @param rootPath  The watch-root that filePath lives under.
 */
function inferSystem(filePath: string, rootPath: string): string {
  const relative = path.relative(rootPath, filePath);
  const parts = relative.split(path.sep);

  // Walk from the deepest folder outward (closest ancestor wins).
  for (let i = parts.length - 2; i >= 0; i--) {
    const key = normaliseFolder(parts[i]);
    if (FOLDER_TO_SYSTEM[key]) return FOLDER_TO_SYSTEM[key];
  }

  // Fall back to extension.
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_SYSTEM[ext] ?? "arcade";
}

/**
 * Recursively collect all ROM files under `dir`, up to `maxDepth` levels deep.
 * Returns an array of absolute file paths.
 */
function collectRomFiles(dir: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) return [];
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results; // unreadable directory — skip
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRomFiles(fullPath, depth + 1));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ROM_EXTENSIONS.has(ext)) results.push(fullPath);
    }
  }
  return results;
}

/**
 * Scan a single watch-root. Returns the number of newly-imported ROMs.
 * Populates `pathStats` for the given root.
 */
async function scanPath(
  rootPath: string,
  existingNames: Set<string>,
): Promise<number> {
  if (!_addRom) return 0;

  if (!fs.existsSync(rootPath)) {
    _status.pathStats[rootPath] = { found: 0, error: `Path not found: ${rootPath}` };
    console.warn(`[Scanner] Path not found: ${rootPath}`);
    return 0;
  }

  let found = 0;
  const romFiles = collectRomFiles(rootPath);

  for (const filePath of romFiles) {
    const fileName = path.basename(filePath);
    if (existingNames.has(fileName)) continue;

    const ext      = path.extname(fileName).toLowerCase();
    const system   = inferSystem(filePath, rootPath);
    const baseName = path.basename(fileName, ext);
    const title    = baseName.replace(/[_\-.]+/g, " ").trim();
    const slug =
      baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
      + "-" + Date.now().toString(36)
      + Math.random().toString(36).slice(2, 5);

    try {
      const stat = fs.statSync(filePath);
      await _addRom({
        title, system, slug,
        originalName: fileName,
        fileName,
        filePath,
        size: stat.size,
        mimeType: "application/octet-stream",
        createdAt: Date.now(),
      });
      // Mark as seen so duplicate filenames in other paths don't re-import.
      existingNames.add(fileName);
      found++;
      _status.totalScanned++;
    } catch {
      // Slug collision or constraint violation — skip silently.
    }
  }

  _status.pathStats[rootPath] = { found, error: null };
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scan loop
// ─────────────────────────────────────────────────────────────────────────────

async function doScan(): Promise<void> {
  if (!_addRom || !_listFilenames) return;

  // Resolve the current set of paths: env paths + DB-stored NAS paths.
  const nasPaths = _getNasPaths ? (await _getNasPaths().catch(() => [])) : [];
  const allPaths = Array.from(new Set([..._envPaths, ...nasPaths].filter(Boolean)));

  if (allPaths.length === 0) {
    _status.watchPaths = [];
    _status.watchDir   = null;
    return;
  }

  _status.watchPaths = allPaths;
  _status.watchDir   = allPaths.join(", ");
  _status.enabled    = true;
  _status.watching   = true;

  try {
    const existingNames = new Set(await _listFilenames());
    let totalFound = 0;

    for (const p of allPaths) {
      const found = await scanPath(p, existingNames);
      totalFound += found;
    }

    _status.lastScanAt    = Date.now();
    _status.lastScanFound = totalFound;
    _status.error         = null;

    if (totalFound > 0) {
      console.log(`[Scanner] Imported ${totalFound} new ROM(s) from ${allPaths.length} path(s).`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    _status.error = msg;
    console.error("[Scanner] scan error:", msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise the scanner.
 *
 * @param watchDir      Value of CABINET_ROM_WATCH_DIR (comma-separated paths).
 * @param addRom        Callback to persist a newly-discovered ROM.
 * @param listFilenames Callback to fetch already-known file names (dedup).
 * @param getNasPaths   Optional callback to load additional NAS paths from DB.
 */
export function initScanner(
  watchDir: string,
  addRom: AddRomFn,
  listFilenames: ListFilenamesFn,
  getNasPaths?: GetNasPathsFn,
): () => Promise<void> {
  _addRom        = addRom;
  _listFilenames = listFilenames;
  _getNasPaths   = getNasPaths ?? null;

  // Support comma-separated paths in the env var.
  _envPaths = watchDir
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  _status.watchPaths = _envPaths;
  _status.watchDir   = _envPaths.join(", ") || null;
  _status.enabled    = true;
  _status.watching   = true;

  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(doScan, POLL_INTERVAL_MS);

  void doScan();
  return doScan;
}

/**
 * Re-initialise scanner with an updated set of NAS paths from the DB.
 * Called by the routes layer whenever the user saves new NAS settings.
 */
export function refreshNasPaths(getNasPaths: GetNasPathsFn): void {
  _getNasPaths = getNasPaths;
}

/** Trigger an on-demand scan immediately. */
export function scanNow(): Promise<void> {
  return doScan();
}

/** Return a snapshot of the current scanner state. */
export function getStatus(): ScannerStatus {
  return { ..._status, pathStats: { ..._status.pathStats } };
}

/**
 * Utility: given a root path, recursively detect platform sub-folders.
 * Used by the library-scan preview endpoint.
 */
export interface DetectedFolder {
  folderName: string;
  fullPath: string;
  platformId: string | null;  // null = unmatched
  detectionMethod: "exact" | "alias" | "manual" | null;
  fileCount: number;
  sampleFiles: string[];
}

export function detectPlatformFolders(rootPath: string): DetectedFolder[] {
  const results: DetectedFolder[] = [];
  let topLevel: fs.Dirent[];
  try {
    topLevel = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of topLevel) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(rootPath, entry.name);
    const key = normaliseFolder(entry.name);
    const platformId = FOLDER_TO_SYSTEM[key] ?? null;

    // Collect ROM files (top level of this subfolder only for the preview).
    let files: fs.Dirent[] = [];
    try { files = fs.readdirSync(folderPath, { withFileTypes: true }); } catch { /* skip */ }
    const romFiles = files
      .filter((f) => f.isFile() && ROM_EXTENSIONS.has(path.extname(f.name).toLowerCase()))
      .map((f) => f.name);

    results.push({
      folderName: entry.name,
      fullPath: folderPath,
      platformId,
      detectionMethod: platformId ? (FOLDER_TO_SYSTEM[entry.name.toLowerCase()] ? "exact" : "alias") : null,
      fileCount: romFiles.length,
      sampleFiles: romFiles.slice(0, 5),
    });
  }

  return results;
}
