import type { Express } from "express";
import { listOpenRooms } from "../netplay";

export function registerNetplayRoutes(app: Express) {
  // ── Netplay lobby ─────────────────────────────────────────────────────────────────
  app.get("/api/netplay/rooms", (_req, res) => {
    res.json(listOpenRooms());
  });
}
