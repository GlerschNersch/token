import type { Express } from "express";
import * as scanner from "../scanner";

export function registerScannerRoutes(app: Express) {
  // ── ROM scanner ──────────────────────────────────────────────────────────────────────
  app.get("/api/scanner/status", (_req, res) => {
    res.json(scanner.getStatus());
  });

  app.post("/api/scanner/scan-now", async (_req, res) => {
    try {
      await scanner.scanNow();
      res.json({ ok: true, status: scanner.getStatus() });
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });
}
