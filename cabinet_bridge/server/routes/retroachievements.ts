import { Express } from "express";
import { storage } from "../storage";

export function registerRetroAchievementsRoutes(app: Express) {
  app.get("/api/retroachievements/game-info/:id", async (req, res) => {
    const id = req.params.id;
    const settings = await storage.getIntegrationSettings();
    if (!settings.retroAchievementsEnabled || !settings.retroAchievementsUser || !settings.retroAchievementsToken) {
      return res.status(400).json({ message: "RetroAchievements not configured." });
    }

    try {
      const url = `https://retroachievements.org/API/API_GetGame.php?z=${settings.retroAchievementsUser}&y=${settings.retroAchievementsToken}&i=${id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`RA API returned ${response.status}`);
      res.json(await response.json());
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.get("/api/retroachievements/user-progress/:id", async (req, res) => {
    const id = req.params.id;
    const settings = await storage.getIntegrationSettings();
    if (!settings.retroAchievementsEnabled || !settings.retroAchievementsUser || !settings.retroAchievementsToken) {
      return res.status(400).json({ message: "RetroAchievements not configured." });
    }

    try {
      const url = `https://retroachievements.org/API/API_GetGameInfoAndUserProgress.php?z=${settings.retroAchievementsUser}&y=${settings.retroAchievementsToken}&u=${settings.retroAchievementsUser}&g=${id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`RA API returned ${response.status}`);
      res.json(await response.json());
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });
}
