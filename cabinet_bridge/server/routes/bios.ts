import type { Express } from "express";
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { dataPath, ensureDir } from "../data-dir";

// Standard BIOS filenames expected by EmulatorJS cores
export const REQUIRED_BIOS: Record<string, string[]> = {
  psx: ["scph5501.bin"],
  pcsx2: ["scph39001.bin"],
  segaCD: ["bios_CD_U.bin"],
  gba: ["gba_bios.bin"],
  yabause: ["saturn_bios.bin"],
  reicast: ["dc_boot.bin", "dc_flash.bin"],
};

const BIOS_ROOT = path.resolve(dataPath("bios"));

export function registerBiosRoutes(app: Express) {
  ensureDir(BIOS_ROOT);

  // Get status of all required BIOS files
  app.get("/api/bios", async (_req, res) => {
    const status: Record<string, Array<{ filename: string; exists: boolean }>> = {};
    
    for (const [core, files] of Object.entries(REQUIRED_BIOS)) {
      status[core] = await Promise.all(
        files.map(async (filename) => {
          try {
            await fs.access(path.join(BIOS_ROOT, filename));
            return { filename, exists: true };
          } catch {
            return { filename, exists: false };
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
      const canonicalFilename = allAllowedFiles.find(
        (f) => f.toLowerCase() === rawFilename.toLowerCase()
      );

      if (!canonicalFilename) {
        return res.status(400).json({ message: `Filename '${rawFilename}' is not a recognized BIOS file.` });
      }

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
