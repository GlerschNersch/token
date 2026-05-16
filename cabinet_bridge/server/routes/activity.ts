import type { Express } from "express";
import { storage } from "../storage";

export function registerActivityRoutes(app: Express) {
  app.get("/api/history", async (_req, res) => {
    const history = await storage.listRecentSessions(100);
    res.json(history);
  });

  app.get("/api/achievements", async (_req, res) => {
    res.json([]);
  });
}
