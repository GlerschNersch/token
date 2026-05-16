// Console definitions and uploaded-library helpers. The active game catalog is
// intentionally empty by default; ROM uploads from the backend populate it.
import type { UploadedRom } from "@shared/schema";
import { apiUrl } from "@/lib/queryClient";
import {
  SYSTEM_IMAGES,
  systemImageProxyPath,
  type SystemImage,
  isSystemImageId,
} from "@shared/system-images";

export type SystemId =
  | "favorites"
  | "backlog"
  | "playing"
  | "completed"
  | "dropped"
  | "recent"
  | "all"
  | "nes"
  | "snes"
  | "n64"
  | "gba"
  | "ps1"
  | "ps2"
  | "genesis"
  | "arcade"
  | "dreamcast"
  | "gb"
  | "gbc"
  | "nds"
  | "psp"
  | "atari2600"
  | "saturn"
  | "gamegear"
  | "sms"
  | "pce"
  | "sega32x"
  | "segacd"
  | "neogeo"
  | "virtualboy"
  | "atari7800"
  | "lynx";

export interface System {
  id: SystemId;
  name: string;
  shortName: string;
  era: string;
  count: number;
  /** Two HSL stops for the system tile gradient. */
  art: [string, string];
  /** Webhook id slug — appears in example HA endpoint URLs. */
  slug: string;
  /** Optional pixel-art-style monogram (1-3 chars). */
  mono: string;
  /** Console hardware photo metadata; URL is rewritten to a same-origin proxy. */
  image?: SystemImage;
}

function systemImage(id: string): SystemImage | undefined {
  if (!isSystemImageId(id)) return undefined;
  const upstream = SYSTEM_IMAGES[id];
  return { ...upstream, url: apiUrl(systemImageProxyPath(id)) };
}

export interface Game {
  id: string;
  title: string;
  system: SystemId;
  year: number;
  genre: string;
  players: string;
  description?: string | null;
  developer?: string | null;
  publisher?: string | null;
  rating: number; // 1-5
  /** Three HSL color stops for the cover art gradient. */
  art: [string, string, string];
  /** Optional scraped cover-art URL. */
  artUrl?: string | null;
  /** Slug used in example webhook URLs. */
  slug: string;
  /** Backend ROM id when this library item came from an uploaded ROM. */
  romId?: number;
  /** MD5 hash of the ROM file, for verification. */
  romHash?: string | null;
  /** Last-played epoch ms (0 if never). */
  lastPlayed?: number;
  /** Total minutes played. */
  minutesPlayed?: number;
  /** Total number of play sessions. */
  playCount?: number;
  favorite?: boolean;
  playStatus?: string;
  communityScore?: number | null;
  wheelArtUrl?: string | null;
  videoUrl?: string | null;
  createdAt?: number;
  discGroup?: string | null;
  discNumber?: number | null;
  isMultiDisc?: boolean;
  discIds?: number[];
  raGameId?: number | null;
}

export const SYSTEMS: System[] = [
  {
    id: "arcade",
    name: "Arcade",
    shortName: "Arcade",
    era: "1980s+",
    count: 2310,
    art: ["322 92% 56%", "42 96% 56%"],
    slug: "arcade",
    mono: "ARC",
    image: systemImage("arcade"),
  },
  {
    id: "atari2600",
    name: "Atari 2600",
    shortName: "Atari 2600",
    era: "1977",
    count: 565,
    art: ["25 88% 46%", "18 92% 36%"],
    slug: "atari2600",
    mono: "2600",
    image: systemImage("atari2600"),
  },
  {
    id: "nes",
    name: "Nintendo Entertainment System",
    shortName: "NES",
    era: "1985",
    count: 714,
    art: ["0 76% 52%", "16 88% 48%"],
    slug: "nes",
    mono: "NES",
    image: systemImage("nes"),
  },
  {
    id: "atari7800",
    name: "Atari 7800",
    shortName: "Atari 7800",
    era: "1986",
    count: 59,
    art: ["36 70% 28%", "24 80% 44%"],
    slug: "atari7800",
    mono: "A78",
    image: systemImage("atari7800"),
  },
  {
    id: "sms",
    name: "Sega Master System",
    shortName: "Master Sys.",
    era: "1985",
    count: 326,
    art: ["195 62% 24%", "205 72% 38%"],
    slug: "sms",
    mono: "SMS",
    image: systemImage("sms"),
  },
  {
    id: "pce",
    name: "TurboGrafx-16",
    shortName: "TurboGrafx",
    era: "1987",
    count: 678,
    art: ["275 55% 32%", "265 65% 46%"],
    slug: "pce",
    mono: "PCE",
    image: systemImage("pce"),
  },
  {
    id: "genesis",
    name: "Sega Genesis",
    shortName: "Genesis",
    era: "1988",
    count: 689,
    art: ["220 78% 52%", "200 76% 48%"],
    slug: "genesis",
    mono: "GEN",
    image: systemImage("genesis"),
  },
  {
    id: "gb",
    name: "Game Boy",
    shortName: "Game Boy",
    era: "1989",
    count: 1046,
    art: ["210 20% 60%", "210 15% 45%"],
    slug: "gb",
    mono: "GB",
    image: systemImage("gb"),
  },
  {
    id: "lynx",
    name: "Atari Lynx",
    shortName: "Lynx",
    era: "1989",
    count: 73,
    art: ["200 55% 28%", "190 65% 42%"],
    slug: "lynx",
    mono: "LNX",
    image: systemImage("lynx"),
  },
  {
    id: "gamegear",
    name: "Sega Game Gear",
    shortName: "Game Gear",
    era: "1990",
    count: 363,
    art: ["155 55% 28%", "165 65% 40%"],
    slug: "gamegear",
    mono: "GG",
    image: systemImage("gamegear"),
  },
  {
    id: "neogeo",
    name: "Neo Geo",
    shortName: "Neo Geo",
    era: "1990",
    count: 148,
    art: ["220 70% 20%", "234 80% 38%"],
    slug: "neogeo",
    mono: "NEO",
    image: systemImage("neogeo"),
  },
  {
    id: "snes",
    name: "Super Nintendo",
    shortName: "SNES",
    era: "1990",
    count: 1042,
    art: ["264 70% 58%", "322 78% 56%"],
    slug: "snes",
    mono: "SNES",
    image: systemImage("snes"),
  },
  {
    id: "segacd",
    name: "Sega CD",
    shortName: "Sega CD",
    era: "1991",
    count: 197,
    art: ["195 60% 25%", "210 70% 40%"],
    slug: "segacd",
    mono: "SCD",
    image: systemImage("segacd"),
  },
  {
    id: "sega32x",
    name: "Sega 32X",
    shortName: "32X",
    era: "1994",
    count: 40,
    art: ["0 78% 36%", "14 88% 48%"],
    slug: "sega32x",
    mono: "32X",
    image: systemImage("sega32x"),
  },
  {
    id: "saturn",
    name: "Sega Saturn",
    shortName: "Saturn",
    era: "1994",
    count: 1058,
    art: ["210 55% 28%", "220 65% 42%"],
    slug: "saturn",
    mono: "SAT",
    image: systemImage("saturn"),
  },
  {
    id: "ps1",
    name: "PlayStation",
    shortName: "PS1",
    era: "1994",
    count: 982,
    art: ["232 60% 54%", "284 60% 50%"],
    slug: "psx",
    mono: "PS1",
    image: systemImage("ps1"),
  },
  {
    id: "virtualboy",
    name: "Virtual Boy",
    shortName: "Virtual Boy",
    era: "1995",
    count: 22,
    art: ["0 90% 20%", "0 75% 35%"],
    slug: "virtualboy",
    mono: "VB",
    image: systemImage("virtualboy"),
  },
  {
    id: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    era: "1996",
    count: 296,
    art: ["188 80% 46%", "210 76% 52%"],
    slug: "n64",
    mono: "N64",
    image: systemImage("n64"),
  },
  {
    id: "gbc",
    name: "Game Boy Color",
    shortName: "GBC",
    era: "1998",
    count: 576,
    art: ["142 72% 42%", "158 68% 34%"],
    slug: "gbc",
    mono: "GBC",
    image: systemImage("gbc"),
  },
  {
    id: "dreamcast",
    name: "Sega Dreamcast",
    shortName: "Dreamcast",
    era: "1998",
    count: 244,
    art: ["28 92% 56%", "16 88% 48%"],
    slug: "dreamcast",
    mono: "DC",
    image: systemImage("dreamcast"),
  },
  {
    id: "ps2",
    name: "PlayStation 2",
    shortName: "PS2",
    era: "2000",
    count: 1456,
    art: ["232 70% 38%", "264 60% 30%"],
    slug: "ps2",
    mono: "PS2",
    image: systemImage("ps2"),
  },
  {
    id: "gba",
    name: "Game Boy Advance",
    shortName: "GBA",
    era: "2001",
    count: 1180,
    art: ["288 70% 56%", "200 80% 52%"],
    slug: "gba",
    mono: "GBA",
    image: systemImage("gba"),
  },
  {
    id: "nds",
    name: "Nintendo DS",
    shortName: "NDS",
    era: "2004",
    count: 1694,
    art: ["210 90% 56%", "228 80% 48%"],
    slug: "nds",
    mono: "NDS",
    image: systemImage("nds"),
  },
  {
    id: "psp",
    name: "PlayStation Portable",
    shortName: "PSP",
    era: "2005",
    count: 1320,
    art: ["220 72% 52%", "240 64% 44%"],
    slug: "psp",
    mono: "PSP",
    image: systemImage("psp"),
  },
];


export const GAMES: Game[] = [];

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  /** Default example endpoint shown in Settings + used as the simulated call target. */
  defaultEndpoint: string;
  /** Lucide icon name string (handled in component). */
  icon: "Power" | "Moon" | "Zap" | "Tv" | "Gamepad2" | "RotateCw" | "Volume2";
  tone: "primary" | "warning" | "neutral" | "danger";
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "wake_pc",
    label: "Wake PC",
    description: "Send Wake-on-LAN magic packet via HA",
    defaultEndpoint: "/api/webhook/cabinet_wake_pc",
    icon: "Zap",
    tone: "primary",
  },
  {
    id: "launch_retrobat",
    label: "Start RetroBat",
    description: "Launch RetroBat / Big Picture frontend",
    defaultEndpoint: "/api/webhook/cabinet_start_retrobat",
    icon: "Tv",
    tone: "primary",
  },
  {
    id: "arcade_mode",
    label: "Arcade Mode",
    description: "Dim lights, cabinet scene",
    defaultEndpoint: "/api/webhook/cabinet_arcade_mode",
    icon: "Gamepad2",
    tone: "neutral",
  },
  {
    id: "sleep_pc",
    label: "Sleep",
    description: "Suspend the emulator PC",
    defaultEndpoint: "/api/webhook/cabinet_sleep_pc",
    icon: "Moon",
    tone: "warning",
  },
  {
    id: "restart_pc",
    label: "Restart",
    description: "Reboot the emulator PC",
    defaultEndpoint: "/api/webhook/cabinet_restart_pc",
    icon: "RotateCw",
    tone: "neutral",
  },
  {
    id: "shutdown_pc",
    label: "Shutdown",
    description: "Power off the emulator PC",
    defaultEndpoint: "/api/webhook/cabinet_shutdown_pc",
    icon: "Power",
    tone: "danger",
  },
];

/** Build a launch endpoint slug for a given game. Matches what the Settings UI explains. */
export function gameLaunchEndpoint(game: Game): string {
  return `/api/webhook/cabinet_launch_${game.slug}`;
}

export function uploadedRomToGame(rom: UploadedRom): Game {
  const system = SYSTEMS.find((s) => s.id === rom.system);
  const [a, b] = system?.art ?? ["322 92% 56%", "188 90% 52%"];
  return {
    id: `uploaded-${rom.id}`,
    title: rom.title,
    system: rom.system as SystemId,
    // Use 0 when no scraped year is available — GameDetailDialog guards with `year > 0`
    // so the year badge simply won't render rather than showing the upload year.
    year: rom.releaseYear ?? 0,
    genre: rom.genre ?? "Uploaded ROM",
    players: rom.players ?? "1",
    description: rom.description ?? null,
    developer: rom.developer ?? null,
    publisher: rom.publisher ?? null,
    rating: rom.rating ?? 0,
    art: [a, b, "42 96% 56%"],
    artUrl: rom.artUrl,
    slug: rom.slug,
    romId: rom.id,
    lastPlayed: rom.lastPlayed ?? 0,
    minutesPlayed: rom.minutesPlayed ?? 0,
    playCount: rom.playCount ?? 0,
    romHash: rom.romHash ?? null,
    favorite: rom.favorite,
    playStatus: rom.playStatus ?? "unset",
    communityScore: rom.communityScore ?? null,
    wheelArtUrl: rom.wheelArtUrl ?? null,
    videoUrl: (rom as Record<string, unknown>).videoUrl as string | null ?? null,
    createdAt: rom.createdAt,
    discGroup: rom.discGroup,
    discNumber: rom.discNumber,
    raGameId: rom.raGameId,
  };
}

export function formatRomSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
