import type { Express } from "express";
import { storage } from "../storage";

export function registerActivityRoutes(app: Express) {
  app.get("/api/history", async (_req, res) => {
    // Falls back to recent sessions if listPlayHistory is not specifically implemented
    const history = await storage.listRecentSessions(100);
    res.json(history);
  });

  app.get("/api/achievements", async (_req, res) => {
    // Achievements are not yet implemented in storage, return empty array for now
    res.json([]);
  });
}
