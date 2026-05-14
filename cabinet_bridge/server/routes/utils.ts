import path from "node:path";
import zlib from "node:zlib";

/**
 * Minimal ZIP extractor using Node built-in zlib.
 * Returns { buffer, fileName } for the first entry whose extension is in
 * allowedExtensions, or null when no matching entry is found.
 */
export async function extractFirstRomFromZip(
  zipBuffer: Buffer,
  allowedExtensions: string[],
): Promise<{ buffer: Buffer; fileName: string } | null> {
  let offset = 0;
  while (offset + 30 < zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize    = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength    = zipBuffer.readUInt16LE(offset + 26);
    const extraLength       = zipBuffer.readUInt16LE(offset + 28);
    const fileName          = zipBuffer.subarray(offset + 30, offset + 30 + fileNameLength).toString("utf8");
    const dataStart         = offset + 30 + fileNameLength + extraLength;
    const dataEnd           = dataStart + compressedSize;

    const ext = path.extname(fileName).toLowerCase();
    if (allowedExtensions.includes(ext) && !fileName.startsWith("__MACOSX")) {
      const compressed = zipBuffer.subarray(dataStart, dataEnd);
      try {
        const buffer =
          compressionMethod === 0
            ? compressed
            : await new Promise<Buffer>((resolve, reject) => {
                zlib.inflateRaw(compressed, (err, result) => {
                  err ? reject(err) : resolve(result);
                });
              });
        return { buffer, fileName: path.basename(fileName) };
      } catch {
        // corrupt entry — try next
      }
    }
    offset = dataEnd;
  }
  return null;
}

export function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function titleFromFileName(fileName: string) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\s*\([A-Z][a-zA-Z,\s]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*\((Rev|v|Beta|Proto|Demo|Sample|Hack|Alt|Unl)[^)]*\)/gi, "")
    .replace(/\s*\(Dis[ck][^)]*\)/gi, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "rom"
  );
}

export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function significantTokens(value: string) {
  const noise = new Set([
    "u", "usa", "us", "eng", "snes", "sfc", "smc", "rev", "version",
  ]);
  const roman: Record<string, string> = {
    i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  };
  const rawTokens = value.split(/\s+/).filter(Boolean);
  return rawTokens
    .filter((token, index, tokens) => {
      if (noise.has(token)) return false;
      if (token === "v" && /^\d+$/.test(tokens[index + 1] ?? "")) return false;
      if (/^\d+$/.test(token) && tokens[index - 1] === "v") return false;
      return true;
    })
    .map((token) => roman[token] ?? token);
}

export function normalizeSearchTitle(value: string) {
  return significantTokens(normalizeTitle(value)).join(" ");
}

export function numberTokens(tokens: string[]) {
  return tokens.filter((token) => /^\d+$/.test(token));
}
