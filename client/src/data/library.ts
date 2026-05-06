// Console definitions and uploaded-library helpers. The active game catalog is
// intentionally empty by default; ROM uploads from the backend populate it.
import type { UploadedRom } from "@shared/schema";
import {
  SYSTEM_IMAGES,
  systemImageProxyPath,
  type SystemImage,
  isSystemImageId,
} from "@shared/system-images";

export type SystemId =
  | "favorites"
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
  | "dreamcast";

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
  return { ...upstream, url: systemImageProxyPath(id) };
}

export interface Game {
  id: string;
  title: string;
  system: SystemId;
  year: number;
  genre: string;
  players: string;
  rating: number; // 1-5
  /** Three HSL color stops for the cover art gradient. */
  art: [string, string, string];
  /** Optional scraped cover-art URL. */
  artUrl?: string | null;
  /** Slug used in example webhook URLs. */
  slug: string;
  /** Backend ROM id when this library item came from an uploaded ROM. */
  romId?: number;
  /** Last-played epoch ms (0 if never). */
  lastPlayed?: number;
  /** Total minutes played. */
  minutesPlayed?: number;
  favorite?: boolean;
}

export const SYSTEMS: System[] = [
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
    year: new Date(rom.createdAt).getFullYear(),
    genre: "Uploaded ROM",
    players: "1",
    rating: rom.rating ?? 0,
    art: [a, b, "42 96% 56%"],
    artUrl: rom.artUrl,
    slug: rom.slug,
    romId: rom.id,
    lastPlayed: rom.lastPlayed ?? 0,
    minutesPlayed: rom.playCount ? rom.playCount * 5 : 0,
    favorite: rom.favorite,
  };
}

export function formatRomSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
