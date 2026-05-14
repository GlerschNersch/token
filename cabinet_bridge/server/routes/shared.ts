import path from "node:path";
import { dataPath } from "../data-dir";

// In-memory "now playing" state — tracks the game currently open in the browser player
export let nowPlayingRom: { id: number; title: string; system: string } | null = null;
export let activeSessionId: number | null = null;
export let activeSessionStart = 0;

export function updateNowPlaying(rom: typeof nowPlayingRom) {
  nowPlayingRom = rom;
}

export function updateActiveSession(id: number | null, start: number) {
  activeSessionId = id;
  activeSessionStart = start;
}

export const ROM_EXTENSIONS: Record<string, string[]> = {
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

export const MAX_UPLOAD_MB = (() => {
  const raw = Number.parseInt(process.env.CABINET_MAX_UPLOAD_MB ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 2048; // 2 GB default
})();
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const EMULATORJS_CORES: Record<string, string> = {
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

export const ROM_ROOT = path.resolve(dataPath("rom-storage"));
export const SAVE_BACKUP_DIR = path.resolve(dataPath("save-backups"));
export const SYSTEM_IMAGE_CACHE_DIR = path.resolve(dataPath("system-image-cache"));
export const SYSTEM_LOGO_CACHE_DIR  = path.resolve(dataPath("system-logo-cache"));

export const SYSTEM_IMAGE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "CabinetBridge/0.4 (+https://github.com/GlerschNersch/token; mailto:noreply@anthropic.com) Mozilla/5.0",
  Referer: "https://commons.wikimedia.org/",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

export const LIBRETRO_PLAYLISTS: Record<string, string> = {
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

export function getUserFromRequest(req: any): { userId: string; userName: string } {
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
