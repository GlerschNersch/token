import fs from "node:fs";
import path from "node:path";

let resolvedDataDir: string | null = null;

function isWritableDir(dir: string): boolean {
  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return false;
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function detectDataDir(): string {
  const explicit = process.env.CABINET_DATA_DIR;
  if (explicit) {
    fs.mkdirSync(explicit, { recursive: true });
    return path.resolve(explicit);
  }

  const haIndicators =
    process.env.SUPERVISOR_TOKEN ||
    process.env.HASSIO_TOKEN ||
    process.env.HASSIO ||
    process.env.HOME_ASSISTANT;

  if (haIndicators && isWritableDir("/data")) {
    return "/data";
  }

  if (isWritableDir("/data")) {
    return "/data";
  }

  return process.cwd();
}

export function getDataDir(): string {
  if (!resolvedDataDir) {
    resolvedDataDir = detectDataDir();
  }
  return resolvedDataDir;
}

export function dataPath(...segments: string[]): string {
  return path.join(getDataDir(), ...segments);
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
