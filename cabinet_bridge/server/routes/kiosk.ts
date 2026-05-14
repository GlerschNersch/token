import { Express } from "express";
import { storage } from "../storage";
import express from "express";

export function registerKioskRoutes(app: Express) {
  // Kiosk mode config — public so the client can read it before auth
  app.get("/api/kiosk", async (_req, res) => {
    const settings = await storage.getIntegrationSettings();
    res.json({
      enabled: settings.kioskMode ?? false,
      lockSettings: settings.kioskLockSettings ?? false,
      hasPin: !!settings.kioskPin,
    });
  });

  app.post("/api/kiosk/verify-pin", express.json(), async (req, res) => {
    const { pin } = req.body;
    const settings = await storage.getIntegrationSettings();
    if (!settings.kioskPin || pin === settings.kioskPin) {
      return res.json({ ok: true });
    }
    res.status(401).json({ ok: false, message: "Invalid PIN." });
  });
}
