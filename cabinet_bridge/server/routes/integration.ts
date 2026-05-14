import type { Express } from "express";
import { storage } from "../storage";
import { integrationSettingsSchema } from "@shared/schema";
import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// Auto-configure HA panel_iframe so HomeArcade is accessible to all HA users.
// Runs once at startup inside the HA add-on environment (SUPERVISOR_TOKEN set).
// ---------------------------------------------------------------------------
async function ensurePanelIframe(): Promise<void> {
  const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
  if (!SUPERVISOR_TOKEN) return; // not running inside HA add-on

  const CONFIG_PATH = "/config/configuration.yaml";
  const MARKER = "# homearcade-panel-iframe-auto";

  try {
    const infoRes = await fetch("http://supervisor/addons/self/info", {
      headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` },
    });
    if (!infoRes.ok) return;
    const info = (await infoRes.json()) as { data?: { ingress_entry?: string } };
    const ingressUrl = info.data?.ingress_entry;
    if (!ingressUrl) return;

    let configYaml = "";
    try {
      configYaml = await fs.readFile(CONFIG_PATH, "utf8");
    } catch {
      return; // configuration.yaml missing or unreadable
    }

    if (configYaml.includes(MARKER)) return;

    const panelEntry = [
      `  homearcade:`,
      `    title: HomeArcade`,
      `    url: "${ingressUrl}"`,
      `    icon: mdi:gamepad-variant`,
      `    require_admin: false`,
    ].join("\n");

    let updated: string;
    if (/^panel_iframe:/m.test(configYaml)) {
      updated = configYaml.replace(/^(panel_iframe:)/m, `$1\n${panelEntry}`);
    } else {
      updated = configYaml.trimEnd() + `\n\n${MARKER}\npanel_iframe:\n${panelEntry}\n`;
    }

    await fs.writeFile(CONFIG_PATH, updated, "utf8");

    await fetch(
      "http://supervisor/homeassistant/api/services/homeassistant/reload_all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }
    ).catch(() => {});

    console.log("[HomeArcade] panel_iframe auto-configured");
  } catch (err) {
    console.error("[HomeArcade] panel_iframe auto-config error:", err);
  }
}

export function registerIntegrationRoutes(app: Express) {
  // Auto-configure HA panel_iframe
  ensurePanelIframe().catch(() => {});

  app.get("/api/settings/integration", async (_req, res) => {
    const settings = await storage.getIntegrationSettings();
    res.json(settings);
  });

  const writeIntegrationSettings = async (req: any, res: any) => {
    const parsed = integrationSettingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.message });
    }
    const saved = await storage.saveIntegrationSettings(parsed.data);
    res.json(saved);
  };

  app.put("/api/settings/integration", writeIntegrationSettings);
  app.patch("/api/settings/integration", writeIntegrationSettings);
}
