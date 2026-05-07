import { useState } from "react";
import { THEMES, type AppTheme, applyTheme } from "@/App";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useIntegration } from "@/lib/integration";
import { QUICK_ACTIONS, SYSTEMS, formatRomSize } from "@/data/library";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { filterToPath } from "@/lib/filter";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, Trash2, ChevronRight, Palette } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UploadedRom, GameCollectionWithItems } from "@shared/schema";

export default function Settings() {
  const { config, setConfig, setEndpoint, resetConfig, saveStatus } = useIntegration();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<AppTheme>(
    () => (localStorage.getItem("ha-theme") as AppTheme | null) ?? "default"
  );
  const handleTheme = (t: AppTheme) => {
    applyTheme(t);
    setActiveTheme(t);
  };
  const [esImporting, setEsImporting] = useState(false);
  const [esResult, setEsResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [esError, setEsError] = useState<string | null>(null);
  const [lbImporting, setLbImporting] = useState(false);
  const [lbResult, setLbResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [lbError, setLbError] = useState<string | null>(null);
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-full">
      <Sidebar active="favorites" />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto" data-testid="page-settings">
        <MobileTopBar active="favorites" />

        <div className="px-5 sm:px-10 py-6 sm:py-10 max-w-3xl w-full mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground mb-4"
            data-testid="link-back"
          >
            <ArrowLeft className="size-3.5" /> Back to Library
          </Link>

          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Configuration
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-2">
            Home Assistant integration
          </h1>
          <p className="text-sm text-muted-foreground max-w-prose">
            HomeArcade calls your Home Assistant instance, which in turn runs the
            scripts that wake, launch, or shut down the emulator PC. This panel records
            the URLs HomeArcade will hit. In the prototype, calls are simulated unless
            you toggle Live mode below.
          </p>

          <div
            className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
            data-testid="text-settings-save-status"
          >
            <span
              aria-hidden="true"
              className={`inline-block size-1.5 rounded-full ${
                saveStatus === "saving"
                  ? "bg-amber-400 animate-pulse"
                  : saveStatus === "saved"
                  ? "bg-status-online"
                  : saveStatus === "error"
                  ? "bg-destructive"
                  : saveStatus === "loading"
                  ? "bg-muted-foreground"
                  : "bg-muted-foreground/40"
              }`}
            />
            {saveStatus === "loading"
              ? "Loading saved settings…"
              : saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "Saved"
              : saveStatus === "error"
              ? "Save failed — retry by editing again"
              : "Settings sync to add-on storage"}
          </div>

          <Section
            title="Connection"
            description="Where HomeArcade sends its requests. The base URL is only used when Live mode is on."
          >
            <Field label="Home Assistant base URL" hint="e.g. https://homeassistant.local:8123 or https://ha.example.com">
              <Input
                type="url"
                value={config.haBaseUrl}
                onChange={(e) => setConfig({ haBaseUrl: e.target.value })}
                placeholder="https://homeassistant.local:8123"
                data-testid="input-ha-base"
              />
            </Field>
            <Field
              label="Long-lived access token (optional)"
              hint="Only required for /api/services/* calls. Webhook endpoints under /api/webhook/* are unauthenticated by design."
            >
              <Input
                type="password"
                value={config.haToken}
                onChange={(e) => setConfig({ haToken: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIs…"
                data-testid="input-ha-token"
                autoComplete="off"
              />
            </Field>

            <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3 mt-2">
              <Switch
                id="live-mode"
                checked={config.liveMode}
                onCheckedChange={(checked) => setConfig({ liveMode: !!checked })}
                data-testid="switch-live-mode"
              />
              <div className="flex-1">
                <Label htmlFor="live-mode" className="font-medium text-sm">
                  Live mode
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When off, every action is logged to the Activity panel as a simulation.
                  Turn this on once your HA webhooks exist and the URL above is reachable
                  from the device showing this UI.
                </p>
              </div>
            </div>

            {config.liveMode ? (
              <div
                className="flex items-start gap-2 rounded-md border border-chart-3/40 bg-chart-3/10 px-3 py-2 mt-2 text-xs"
                data-testid="banner-live"
              >
                <AlertTriangle className="size-4 mt-0.5 text-chart-3 shrink-0" />
                <span>
                  Live mode is on. Buttons will issue real <code>POST</code> requests to
                  the configured URLs. Make sure CORS is allowed on your HA reverse proxy
                  for the host this UI is served from.
                </span>
              </div>
            ) : null}
          </Section>

          <Section
            title="ScreenScraper.fr (optional)"
            description="When configured, HomeArcade fetches game descriptions, release years, developers, publishers, and genres automatically on upload. Register for free at screenscraper.fr."
          >
            <Field label="ScreenScraper user ID" hint="Your screenscraper.fr username. Leave blank to skip metadata scraping.">
              <Input
                type="text"
                value={config.ssUserId ?? ""}
                onChange={(e) => setConfig({ ssUserId: e.target.value })}
                placeholder="your_username"
                data-testid="input-ss-userid"
                autoComplete="off"
              />
            </Field>
            <Field label="ScreenScraper password" hint="Your screenscraper.fr password.">
              <Input
                type="password"
                value={config.ssPassword ?? ""}
                onChange={(e) => setConfig({ ssPassword: e.target.value })}
                placeholder="••••••••"
                data-testid="input-ss-password"
                autoComplete="off"
              />
            </Field>
          </Section>

          <Section
            title="Quick action endpoints"
            description="Override the default endpoint for any quick action. Leave blank to use the default."
          >
            <ul className="space-y-3">
              {QUICK_ACTIONS.map((qa) => {
                const value = config.endpoints[qa.id] ?? "";
                const placeholder = qa.defaultEndpoint;
                return (
                  <li
                    key={qa.id}
                    className="rounded-md border border-border bg-background/40 p-3"
                    data-testid={`row-endpoint-${qa.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="font-medium text-sm">{qa.label}</div>
                        <div className="text-xs text-muted-foreground">{qa.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(placeholder, qa.id)}
                        className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        data-testid={`button-copy-${qa.id}`}
                        aria-label={`Copy default endpoint for ${qa.label}`}
                      >
                        {copied === qa.id ? (
                          <>
                            <Check className="size-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <Input
                      value={value}
                      onChange={(e) => setEndpoint(qa.id, e.target.value)}
                      placeholder={placeholder}
                      className="font-mono text-xs"
                      data-testid={`input-endpoint-${qa.id}`}
                    />
                  </li>
                );
              })}
            </ul>
          </Section>

          <RomLibrarySection />

          <Section
            title="Game launch endpoints"
            description={`HomeArcade derives launch URLs as /api/webhook/cabinet_launch_<slug>. These mappings come from your uploaded ROM library.`}
          >
            <div className="rounded-md border border-border bg-background/40 overflow-hidden">
              <table className="w-full text-sm" data-testid="table-launch-endpoints">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2">
                      Game
                    </th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2">
                      Endpoint
                    </th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {uploadedRoms.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Upload ROMs above to generate launch endpoints.
                      </td>
                    </tr>
                  ) : uploadedRoms.map((rom) => {
                    const ep = `/api/webhook/cabinet_launch_${rom.slug}`;
                    return (
                      <tr key={rom.id}>
                        <td className="px-3 py-2 truncate max-w-[180px]">{rom.title}</td>
                        <td className="px-3 py-2 font-mono text-[12px] text-foreground/80 break-all">
                          POST {ep}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => copy(ep, `rom-${rom.id}`)}
                            aria-label={`Copy ${rom.title} endpoint`}
                            data-testid={`button-copy-rom-endpoint-${rom.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copied === `rom-${rom.id}` ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Register one webhook script per uploaded game in HA, or use a single dispatch
              script that takes the slug as a payload field.
            </p>
          </Section>

          <Section
            title="Wiring guide"
            description="What to put on the Home Assistant side."
          >
            <ol className="space-y-3 text-sm">
              <Step n={1} title="Create a Wake-on-LAN service">
                Add the WoL integration in HA and configure a service for your emulator
                PC's MAC address. Wrap it in a script:
                <Code>
                  {`# configuration.yaml
script:
  cabinet_wake_pc:
    sequence:
      - service: wake_on_lan.send_magic_packet
        data:
          mac: "AA:BB:CC:DD:EE:FF"`}
                </Code>
              </Step>
              <Step n={2} title="Expose the script as a webhook">
                Use an automation triggered by a webhook to call the script.
                <Code>
                  {`# automations.yaml
- alias: Cabinet — Wake PC
  trigger:
    - platform: webhook
      webhook_id: cabinet_wake_pc
      allowed_methods: [POST]
      local_only: true
  action:
    - service: script.cabinet_wake_pc`}
                </Code>
              </Step>
              <Step n={3} title="Point HomeArcade at HA">
                Fill the base URL above. HomeArcade will POST to
                <code className="mx-1 font-mono text-[12px]">
                  {"{base}/api/webhook/cabinet_wake_pc"}
                </code>
                with no body when you tap Wake PC.
              </Step>
              <Step n={4} title="Run commands on the PC">
                For Start RetroBat / Sleep / Shutdown, use one of:
                <ul className="list-disc list-inside ml-1 mt-1 space-y-1 text-muted-foreground">
                  <li>HA Assist + an MQTT agent (e.g. <code>iot-link</code>) on the PC</li>
                  <li>HA <code>shell_command</code> running PsExec / OpenSSH</li>
                  <li>NUT or a smart plug for the brutal-but-effective hard cut</li>
                </ul>
              </Step>
              <Step n={5} title="Embed this UI in Home Assistant">
                Add a <code>panel_iframe</code> in <code>configuration.yaml</code>:
                <Code>
                  {`panel_iframe:
  cabinet_bridge:
    title: Cabinet
    icon: mdi:gamepad-variant
    url: https://home-arcade.example.com
    require_admin: false`}
                </Code>
                Or use a Lovelace iframe card. HomeArcade does not store any data in
                the browser, so it works inside HA's sandboxed iframe without warnings.
              </Step>
            </ol>
            <a
              href="https://www.home-assistant.io/integrations/wake_on_lan/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
              data-testid="link-ha-docs"
            >
              Home Assistant Wake-on-LAN docs <ExternalLink className="size-3.5" />
            </a>
          </Section>

          <Section
            title="RetroAchievements (optional)"
            description="Earn achievements for your classic games. Register for free at retroachievements.org. Requires a game supported by the RA database."
          >
            <Field label="RA Username" hint="Your retroachievements.org username.">
              <Input
                type="text"
                value={config.raUsername ?? ""}
                onChange={(e) => setConfig({ raUsername: e.target.value })}
                placeholder="your_ra_username"
                data-testid="input-ra-username"
                autoComplete="off"
              />
            </Field>
            <Field label="RA API Token" hint="Found under Settings → Keys on retroachievements.org.">
              <Input
                type="password"
                value={config.raToken ?? ""}
                onChange={(e) => setConfig({ raToken: e.target.value })}
                placeholder="••••••••"
                data-testid="input-ra-token"
                autoComplete="off"
              />
            </Field>
          </Section>

          <Section
            title="Metadata import — EmulationStation &amp; LaunchBox"
            description="Import game metadata from a gamelist.xml (EmulationStation/Batocera/RetroPie) or LaunchBox Metadata.xml. Games are matched by filename or title."
          >
            <div className="rounded-md border border-border bg-background/40 p-3">
              <Label className="text-sm font-medium">Upload gamelist.xml</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Select a gamelist.xml from EmulationStation, Batocera, or RetroPie.</p>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                data-testid="input-es-xml"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-mono file:uppercase file:tracking-wide file:cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEsImporting(true);
                  setEsResult(null);
                  setEsError(null);
                  try {
                    const buf = await file.arrayBuffer();
                    const res = await fetch("/api/import/emulationstation", {
                      method: "POST",
                      headers: { "Content-Type": "application/xml" },
                      body: buf,
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Import failed");
                    setEsResult({ imported: data.imported, skipped: data.skipped });
                    await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
                  } catch (err) {
                    setEsError(String(err));
                  } finally {
                    setEsImporting(false);
                    e.target.value = "";
                  }
                }}
              />
              {esImporting && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
              {esResult && (
                <p className="text-xs text-status-online mt-2" data-testid="text-es-import-result">
                  ✓ Imported {esResult.imported} game{esResult.imported !== 1 ? "s" : ""}, skipped {esResult.skipped}.
                </p>
              )}
              {esError && (
                <p className="text-xs text-destructive mt-2" data-testid="text-es-import-error">{esError}</p>
              )}
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <Label className="text-sm font-medium">Upload LaunchBox Metadata.xml</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Select a platform XML from your LaunchBox Data/Platforms folder.</p>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                data-testid="input-lb-xml"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-mono file:uppercase file:tracking-wide file:cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLbImporting(true);
                  setLbResult(null);
                  setLbError(null);
                  try {
                    const buf = await file.arrayBuffer();
                    const res = await fetch("/api/import/launchbox", {
                      method: "POST",
                      headers: { "Content-Type": "application/xml" },
                      body: buf,
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Import failed");
                    setLbResult({ imported: data.imported, skipped: data.skipped });
                    await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
                  } catch (err) {
                    setLbError(String(err));
                  } finally {
                    setLbImporting(false);
                    e.target.value = "";
                  }
                }}
              />
              {lbImporting && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
              {lbResult && (
                <p className="text-xs text-status-online mt-2" data-testid="text-lb-import-result">
                  ✓ Imported {lbResult.imported} game{lbResult.imported !== 1 ? "s" : ""}, skipped {lbResult.skipped}.
                </p>
              )}
              {lbError && (
                <p className="text-xs text-destructive mt-2" data-testid="text-lb-import-error">{lbError}</p>
              )}
            </div>
          </Section>

          <Section
            title="RetroAchievements (optional)"
            description="Earn achievements for your classic games. Register for free at retroachievements.org. Requires a game supported by the RA database."
          >
            <Field label="RA Username" hint="Your retroachievements.org username.">
              <Input
                type="text"
                value={config.raUsername ?? ""}
                onChange={(e) => setConfig({ raUsername: e.target.value })}
                placeholder="your_ra_username"
                data-testid="input-ra-username"
                autoComplete="off"
              />
            </Field>
            <Field label="RA API Token" hint="Found under Settings → Keys on retroachievements.org.">
              <Input
                type="password"
                value={config.raToken ?? ""}
                onChange={(e) => setConfig({ raToken: e.target.value })}
                placeholder="••••••••"
                data-testid="input-ra-token"
                autoComplete="off"
              />
            </Field>
          </Section>

          <Section
            title="EmulationStation / Batocera import"
            description="Import game metadata from a gamelist.xml file. Games are matched by filename or title to your uploaded ROMs."
          >
            <div className="rounded-md border border-border bg-background/40 p-3">
              <Label className="text-sm font-medium">Upload gamelist.xml</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Select a gamelist.xml from EmulationStation, Batocera, or RetroPie.</p>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                data-testid="input-es-xml"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-mono file:uppercase file:tracking-wide file:cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEsImporting(true);
                  setEsResult(null);
                  setEsError(null);
                  try {
                    const buf = await file.arrayBuffer();
                    const res = await fetch("/api/import/emulationstation", {
                      method: "POST",
                      headers: { "Content-Type": "application/xml" },
                      body: buf,
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Import failed");
                    setEsResult({ imported: data.imported, skipped: data.skipped });
                    await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
                  } catch (err) {
                    setEsError(String(err));
                  } finally {
                    setEsImporting(false);
                    e.target.value = "";
                  }
                }}
              />
              {esImporting && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
              {esResult && (
                <p className="text-xs text-status-online mt-2" data-testid="text-es-import-result">
                  ✓ Imported {esResult.imported} game{esResult.imported !== 1 ? "s" : ""}, skipped {esResult.skipped}.
                </p>
              )}
              {esError && (
                <p className="text-xs text-destructive mt-2" data-testid="text-es-import-error">{esError}</p>
              )}
            </div>
          </Section>

          <Section
            title="Kiosk / Arcade mode"


            description="Lock the UI to a specific collection, hide upload and settings, and optionally require a PIN to exit. Useful for shared arcade cabinets."
          >
            <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3">
              <Switch
                id="kiosk-mode"
                checked={config.kioskMode ?? false}
                onCheckedChange={(checked) => setConfig({ kioskMode: !!checked })}
                data-testid="switch-kiosk-mode"
              />
              <div className="flex-1">
                <Label htmlFor="kiosk-mode" className="font-medium text-sm">Enable kiosk mode</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hides upload, settings, and management UI. Refresh the page for changes to take effect.
                </p>
              </div>
            </div>
            <Field label="Exit PIN (optional)" hint="4–8 digit PIN required to leave kiosk mode. Leave blank for no PIN.">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={config.kioskPin ?? ""}
                onChange={(e) => setConfig({ kioskPin: e.target.value.replace(/\D/g, "") })}
                placeholder="e.g. 1234"
                data-testid="input-kiosk-pin"
                autoComplete="off"
              />
            </Field>
            <Field label="Locked collection (optional)" hint="When set, kiosk mode shows only games from this collection.">
              <select
                value={config.kioskCollectionId ?? ""}
                onChange={(e) => setConfig({ kioskCollectionId: e.target.value ? Number(e.target.value) : null })}
                data-testid="select-kiosk-collection"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Show all games —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </Section>

          <Section
            title="Now Playing sensor"
            description="HomeArcade exposes a live endpoint so Home Assistant can display what game is currently running."
          >
            <p className="text-xs text-muted-foreground">
              Add a <code>rest</code> sensor to your <code>configuration.yaml</code> that polls the add-on:
            </p>
            <Code>{`rest:
  - resource: http://homeassistant.local:7860/api/now-playing
    scan_interval: 15
    sensor:
      - name: "HomeArcade Now Playing"
        unique_id: homearcade_now_playing
        value_template: >
          {% if value_json.playing %}
            {{ value_json.title }}
          {% else %}
            Idle
          {% endif %}
        json_attributes:
          - playing
          - system
          - id`}</Code>
            <p className="text-xs text-muted-foreground mt-2">
              Optionally create an <code>input_text.homearcade_now_playing</code> helper in HA — HomeArcade
              will update it automatically via the REST API whenever a game starts or stops.
            </p>
            <Code>{`input_text:
  homearcade_now_playing:
    name: HomeArcade Now Playing
    max: 100`}</Code>
          </Section>

          <Section
            title="Lovelace card"
            description="Add HomeArcade as a card to your Home Assistant dashboard — shows now-playing status and a quick-launch shelf of recent games."
          >
            <ol className="space-y-4 list-none p-0 m-0">
              <Step n={1} title="Copy the card file">
                Download <code>homearcade-card.js</code> from the add-on and place it in your HA{" "}
                <code>www/</code> folder (i.e. <code>/config/www/homearcade-card.js</code>).
                <Code>{`# From a terminal on your HA host:
wget -O /config/www/homearcade-card.js \
  http://homeassistant.local:7860/homearcade-card.js`}</Code>
              </Step>
              <Step n={2} title="Register the resource">
                In HA go to <strong>Settings → Dashboards → Resources → Add</strong> and enter:
                <Code>{`URL:  /local/homearcade-card.js
Type: JavaScript Module`}</Code>
              </Step>
              <Step n={3} title="Add the card to a dashboard">
                Edit any dashboard, choose <strong>Add Card → Manual</strong> and paste:
                <Code>{`type: custom:homearcade-card
title: HomeArcade
base_url: http://homeassistant.local:7860
max_recent: 6`}</Code>
              </Step>
            </ol>
            <div className="mt-3 flex items-center gap-2">
              <a
                href="/homearcade-card.js"
                download="homearcade-card.js"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline"
                data-testid="link-download-card"
              >
                <ExternalLink className="size-3.5" /> Download homearcade-card.js
              </a>
            </div>
          </Section>

          <Section
            title="Appearance"
            description="Choose a colour theme for the HomeArcade UI. Your choice is saved in the browser."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  { id: "default",   label: "Default",   swatch: ["#f026ab", "#22d3ee", "#0f0f18"] },
                  { id: "synthwave", label: "Synthwave",  swatch: ["#d946ef", "#06f0e0", "#0b0612"] },
                  { id: "gameboy",   label: "Game Boy",   swatch: ["#4ade80", "#86efac", "#0f1a0a"] },
                  { id: "oled",      label: "OLED Black", swatch: ["#ff2dba", "#06f0e0", "#000000"] },
                ] as { id: AppTheme; label: string; swatch: string[] }[]
              ).map(({ id, label, swatch }) => (
                <button
                  key={id}
                  onClick={() => handleTheme(id)}
                  data-testid={`button-theme-${id}`}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-mono transition-all ${
                    activeTheme === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex gap-1">
                    {swatch.map((c, i) => (
                      <span
                        key={i}
                        className="size-5 rounded-full border border-white/10"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span>{label}</span>
                  {activeTheme === id && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active</span>
                  )}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Reset" description="Clear all overrides set in this session.">
            <Button
              variant="outline"
              onClick={() => resetConfig()}
              data-testid="button-reset-config"
            >
              Reset to defaults
            </Button>
          </Section>
        </div>
      </main>
    </div>
  );
}

function RomLibrarySection() {
  const { data: roms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });
  const scrape = useMutation({
    mutationFn: async (rom: UploadedRom) => {
      const res = await apiRequest("POST", `/api/roms/${rom.id}/scrape-art`);
      return (await res.json()) as UploadedRom;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
    },
  });
  const deleteRom = useMutation({
    mutationFn: async (rom: UploadedRom) => {
      const res = await apiRequest("DELETE", `/api/roms/${rom.id}`);
      return (await res.json()) as { deleted: boolean; id: number; fileRemoved: boolean };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/roms"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/collections"] }),
      ]);
    },
  });

  return (
    <Section
      title="ROM library"
      description="Upload ROMs from each system's page so they're filed under the right console automatically. This panel just lets you manage already-uploaded ROMs."
    >
      <div
        className="rounded-md border border-border bg-card/40 p-4"
        data-testid="rom-upload-redirect"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Where to upload
        </div>
        <p className="text-sm mt-1 max-w-prose">
          Open a system from the sidebar — for example{" "}
          <Link
            href={filterToPath("ps1")}
            className="text-primary hover:underline"
            data-testid="link-upload-ps1"
          >
            PS1
          </Link>
          ,{" "}
          <Link
            href={filterToPath("snes")}
            className="text-primary hover:underline"
            data-testid="link-upload-snes"
          >
            SNES
          </Link>
          , or{" "}
          <Link
            href={filterToPath("nes")}
            className="text-primary hover:underline"
            data-testid="link-upload-nes"
          >
            NES
          </Link>{" "}
          — and you'll see an "Upload ROMs" dropzone pinned to that system. Files dropped there are
          saved under the current console without you having to pick one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SYSTEMS.map((s) => (
            <Link
              key={s.id}
              href={filterToPath(s.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider hover-elevate"
              data-testid={`link-upload-system-${s.id}`}
            >
              {s.shortName}
              <ChevronRight className="size-3" />
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Uploaded library
          </span>
          <span className="font-mono text-[10px] text-muted-foreground" data-testid="text-uploaded-count">
            {roms.length} ROM{roms.length === 1 ? "" : "s"}
          </span>
        </div>
        {roms.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground" data-testid="state-no-roms">
            No uploaded ROMs yet. Open a system page like NES or PS1 to upload.
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="list-uploaded-roms">
            {roms.map((rom) => (
              <li
                key={rom.id}
                className="px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                data-testid={`row-rom-${rom.id}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{rom.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    {rom.system.toUpperCase()} · {formatRomSize(rom.size)} · {rom.scrapeStatus === "matched" ? "art matched" : "no art yet"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    cabinet_launch_{rom.slug}
                  </div>
                </div>
                <div className="shrink-0 flex flex-wrap items-center justify-start sm:justify-end gap-2">
                  {rom.artUrl ? (
                    <img
                      src={rom.artUrl}
                      alt=""
                      className="h-10 w-8 rounded object-cover border border-border"
                      loading="lazy"
                      data-testid={`img-rom-art-${rom.id}`}
                    />
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scrape.mutate(rom)}
                    disabled={scrape.isPending}
                    data-testid={`button-scrape-rom-${rom.id}`}
                  >
                    {rom.artUrl ? "Refresh art" : "Find art"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${rom.title}? This removes the uploaded ROM file, save metadata, and collection links.`,
                        )
                      ) {
                        deleteRom.mutate(rom);
                      }
                    }}
                    disabled={deleteRom.isPending}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-rom-${rom.id}`}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleteRom.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="error-rom-delete">
          {(deleteRom.error as Error).message}
        </div>
      ) : null}

      {deleteRom.isSuccess ? (
        <div className="rounded-md border border-status-online/40 bg-status-online/10 px-3 py-2 text-xs text-status-online" data-testid="success-rom-delete">
          ROM removed from the library. Its save metadata and collection links were cleared too.
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Prototype note: ROM uploads stream through the web app backend. For huge PS1/PS2/Dreamcast images, a production Home Assistant install should usually reference files already stored on your NAS or emulator PC instead of pushing multi-GB files through the browser.
      </p>
    </Section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 pt-6 border-t border-border first:border-t-0 first:pt-0">
      <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4 max-w-prose">{description}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{hint}</p> : null}
      {children}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 size-6 rounded-full bg-arcade-gradient text-white font-mono text-[12px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-sm">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground/80">
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 rounded-md border border-border bg-background/60 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/90">
      <code>{children}</code>
    </pre>
  );
}
