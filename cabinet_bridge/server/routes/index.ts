import type { Express } from "express";
import type { Server } from 'node:http';
import { registerRomRoutes, registerUploadRoute } from "./roms";
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

// BIOS and complex routes temporarily disabled for safety rollback
// import { registerBiosRoutes } from "./bios";

export { registerUploadRoute };

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
  
  // BIOS routes are non-essential for boot and may cause issues if pathing fails
  // registerBiosRoutes(app);
}
