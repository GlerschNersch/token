import type { Express } from "express";
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { dataPath, ensureDir } from "../data-dir";

// Standard BIOS metadata from RetroPie / Libretro standards
export const REQUIRED_BIOS: Record<string, Array<{ filename: string; md5: string }>> = {
  psx: [{ filename: "scph5501.bin", md5: "8a3563914948a6058221b0665b1d4715" }],
  pcsx2: [{ filename: "scph39001.bin", md5: "f396486008892150394e33458c9f086e" }],
  segaCD: [{ filename: "bios_CD_U.bin", md5: "2efd74e3230d924e44c6679a0da0401f" }],
  gba: [{ filename: "gba_bios.bin", md5: "a860e8c0b6d573d191e4ec7db1b1e4f6" }],
  yabause: [{ filename: "saturn_bios.bin", md5: "af5828fdff51384f99b3c4926be27762" }],
  reicast: [
    { filename: "dc_boot.bin", md5: "e10c53c2f8b90bab96ead2d368858623" },
    { filename: "dc_flash.bin", md5: "0a93fcd066914917646199622d64a852" },
  ],
};

const BIOS_ROOT = path.resolve(dataPath("bios"));

async function getMd5(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("md5").update(buffer).digest("hex");
  } catch {
    return "";
  }
}

export function registerBiosRoutes(app: Express) {
  ensureDir(BIOS_ROOT);

  // Get status of all required BIOS files
  app.get("/api/bios", async (_req, res) => {
    const status: Record<string, Array<{ filename: string; exists: boolean; verified: boolean }>> = {};
    
    for (const [core, files] of Object.entries(REQUIRED_BIOS)) {
      status[core] = await Promise.all(
        files.map(async (meta) => {
          const filePath = path.join(BIOS_ROOT, meta.filename);
          try {
            await fs.access(filePath);
            const actualMd5 = await getMd5(filePath);
            return { 
              filename: meta.filename, 
              exists: true, 
              verified: actualMd5 === meta.md5 
            };
          } catch {
            return { filename: meta.filename, exists: false, verified: false };
          }
        })
      );
    }
    
    res.json(status);
  });

  // Upload a BIOS file
  app.post(
    "/api/bios/upload",
    express.raw({ type: "*/*", limit: "50mb" }),
    async (req, res) => {
      const rawFilename = decodeURIComponent(String(req.header("x-bios-filename") ?? ""));
      
      if (!rawFilename) {
        return res.status(400).json({ message: "No filename provided." });
      }

      // Case-insensitive match — find the canonical filename from our allowed list
      const allAllowedFiles = Object.values(REQUIRED_BIOS).flat();
      const matchedMeta = allAllowedFiles.find(
        (m) => m.filename.toLowerCase() === rawFilename.toLowerCase()
      );

      if (!matchedMeta) {
        return res.status(400).json({ message: `Filename '${rawFilename}' is not a recognized BIOS file.` });
      }

      const canonicalFilename = matchedMeta.filename;

      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (body.length === 0) {
        return res.status(400).json({ message: "Empty file body." });
      }

      // Always write using the canonical (lowercase) filename
      const filePath = path.join(BIOS_ROOT, canonicalFilename);
      await fs.writeFile(filePath, body);

      res.status(201).json({ success: true, filename: canonicalFilename });
    }
  );

  // Serve BIOS file for the emulator
  app.get("/api/bios/file/:filename", async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(BIOS_ROOT, filename);

    try {
      await fs.access(filePath);
      res.sendFile(filePath);
    } catch {
      res.status(404).json({ message: "BIOS file not found." });
    }
  });
}
