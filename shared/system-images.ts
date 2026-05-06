// Shared registry of console hardware photos used by the Browse Systems tiles.
// Single source of truth for both the client (metadata) and the server (proxy
// fetching the upstream Wikimedia Commons URL and caching it on disk).

export type SystemImageId =
  | "nes"
  | "snes"
  | "n64"
  | "gba"
  | "genesis"
  | "ps1"
  | "ps2"
  | "arcade"
  | "dreamcast";

export interface SystemImage {
  id: SystemImageId;
  /** Upstream Wikimedia Commons thumbnail URL (640px wide where available). */
  url: string;
  /** Display name of the photo subject. */
  source: string;
  /** Wikimedia Commons file page for attribution. */
  sourceUrl: string;
  /** Short license tag (e.g. "Public domain", "CC-BY-SA-3.0"). */
  license: string;
}

/**
 * Wikimedia Commons photos of each console.
 *
 * The "Evan-Amos / Vanamo Online Game Museum" series is Public Domain
 * (NES, SNES, N64, GBA, Genesis, PS1, PS2). Dreamcast is CC-BY-SA-3.0
 * by the same author. Arcade is CC-BY-SA-2.0 (Marshall Astor / Flickr).
 */
export const SYSTEM_IMAGES: Record<SystemImageId, SystemImage> = {
  nes: {
    id: "nes",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/NES-Console-Set.jpg/640px-NES-Console-Set.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:NES-Console-Set.jpg",
    license: "Public domain",
  },
  snes: {
    id: "snes",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Nintendo-Super-Famicom-Set-FL.jpg/640px-Nintendo-Super-Famicom-Set-FL.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Nintendo-Super-Famicom-Set-FL.jpg",
    license: "Public domain",
  },
  n64: {
    id: "n64",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Nintendo-64-wController-L.jpg/640px-Nintendo-64-wController-L.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Nintendo-64-wController-L.jpg",
    license: "Public domain",
  },
  gba: {
    id: "gba",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Nintendo-Game-Boy-Advance-Purple-FL.jpg/640px-Nintendo-Game-Boy-Advance-Purple-FL.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Nintendo-Game-Boy-Advance-Purple-FL.jpg",
    license: "Public domain",
  },
  genesis: {
    id: "genesis",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Sega-Genesis-Mk2-6button.jpg/640px-Sega-Genesis-Mk2-6button.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sega-Genesis-Mk2-6button.jpg",
    license: "Public domain",
  },
  ps1: {
    id: "ps1",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/PSX-Console-wController.jpg/640px-PSX-Console-wController.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:PSX-Console-wController.jpg",
    license: "Public domain",
  },
  ps2: {
    id: "ps2",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/PS2-Fat-Console-Set.jpg/640px-PS2-Fat-Console-Set.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:PS2-Fat-Console-Set.jpg",
    license: "Public domain",
  },
  arcade: {
    id: "arcade",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Arcade_Donkey_Kong.jpg/640px-Arcade_Donkey_Kong.jpg",
    source: "Marshall Astor (Flickr)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Arcade_Donkey_Kong.jpg",
    license: "CC-BY-SA-2.0",
  },
  dreamcast: {
    id: "dreamcast",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Dreamcast-Console-Set.jpg/640px-Dreamcast-Console-Set.jpg",
    source: "Evan-Amos / Vanamo Online Game Museum",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Dreamcast-Console-Set.jpg",
    license: "CC-BY-SA-3.0",
  },
};

/** Same-origin proxy URL for a given system id. */
export function systemImageProxyPath(id: SystemImageId): string {
  return `/api/system-images/${id}`;
}

export function isSystemImageId(value: string): value is SystemImageId {
  return value in SYSTEM_IMAGES;
}
