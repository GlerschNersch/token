import type { Express } from "express";
import type { Server } from 'node:http';
import { registerRomRoutes } from "./roms";
import { registerProfileRoutes } from "./profiles";
import { registerCollectionRoutes } from "./collections";
import { registerCheatRoutes } from "./cheats";
import { registerActivityRoutes } from "./activity";
import { registerScannerRoutes } from "./scanner";
import { registerNetplayRoutes } from "./netplay";
import { registerIntegrationRoutes } from "./integration";
import { registerSystemRoutes } from "./systems";
import { registerImportRoutes } from "./import";
import { registerScrapeRoutes } from "./scrape";
import { registerRetroAchievementsRoutes } from "./retroachievements";
import { registerKioskRoutes } from "./kiosk";

export async function registerRoutes(_httpServer: Server, app: Express) {
  registerRomRoutes(app);
  registerProfileRoutes(app);
  registerCollectionRoutes(app);
  registerCheatRoutes(app);
  registerActivityRoutes(app);
  registerScannerRoutes(app);
  registerNetplayRoutes(app);
  registerIntegrationRoutes(app);
  registerSystemRoutes(app);
  registerImportRoutes(app);
  registerScrapeRoutes(app);
  registerRetroAchievementsRoutes(app);
  registerKioskRoutes(app);
}

