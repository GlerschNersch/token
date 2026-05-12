import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useIntegration } from "@/lib/integration";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Globe,
  Lock,
  Zap,
  Copy,
  Check,
  RotateCcw,
  Wifi,
  Terminal,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Trash2,
  AlertTriangle,
  Plus,
  Sparkles,
  ScanLine,
} from "lucide-react";
import type { SmartFilterRules } from "@shared/schema";

export default function Settings() {
  const { config, setConfig, setEndpoint, resetConfig, saveStatus } = useIntegration();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard", description: "Endpoint URL is ready to paste." });
  };

  const handleReset = () => {
    if (confirm("Reset all integration settings to default? Your HA base URL and token will be cleared.")) {
      resetConfig();
      toast({ title: "Settings reset", description: "Integration defaults restored." });
    }
  };

  const handleLiveModeToggle = (live: boolean) => {
    if (live) {
      toast({
        title: "Live Mode Enabled",
        description: "App will now attempt to call real Home Assistant webhooks.",
      });
    }
    setConfig({ liveMode: live });
  };

  return (
    <div className="flex h-full">
      <Sidebar active="settings" />

      <main className="flex-1 min-w-0 flex flex-col bg-background/30 overflow-y-auto overscroll-y-contain">
        <MobileTopBar active="settings" />

        <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 space-y-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Integration
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight mt-1">Settings</h1>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus === "saving" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Loader2 className="size-3 animate-spin" /> Saving...
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-accent uppercase tracking-wider">
                  <Check className="size-3" /> All changes saved
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-destructive uppercase tracking-wider">
                  <ShieldAlert className="size-3" /> Save failed
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Connection */}
          <Section
            title="Home Assistant Connection"
            description="Configure how Cabinet Bridge talks to your Home Assistant instance. Use the internal URL if this is running as an add-on."
          >
            <div className="grid gap-6">
              <Field
                label="Base URL"
                hint="External or internal URL including port (e.g. http://192.168.1.50:8123)"
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={config.haBaseUrl}
                      onChange={(e) => setConfig({ haBaseUrl: e.target.value })}
                      placeholder="https://homeassistant.local:8123"
                      className="pl-9 font-mono text-sm"
                      data-testid="input-ha-base"
                    />
                  </div>
                </div>
              </Field>

              <Field
                label="Long-lived Access Token"
                hint="Required for certain actions, but often not needed for simple webhooks."
              >
                <div className="relative">
                  <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={config.haToken}
                    onChange={(e) => setConfig({ haToken: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="pl-9 font-mono text-sm"
                    data-testid="input-ha-token"
                  />
                </div>
              </Field>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-sidebar/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-display font-semibold text-sm">
                    <Zap className="size-4 text-accent" />
                    Live Mode
                  </div>
                  <div className="text-xs text-muted-foreground max-w-sm">
                    When enabled, actions will fire real network requests to Home Assistant.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {config.liveMode ? "Active" : "Simulation"}
                  </span>
                  <Switch
                    checked={config.liveMode}
                    onCheckedChange={handleLiveModeToggle}
                    data-testid="switch-live-mode"
                  />
                </div>
              </div>

              {!config.liveMode && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-accent/20 bg-accent/5">
                  <AlertTriangle className="size-4 text-accent mt-0.5 shrink-0" />
                  <div className="text-xs text-accent/90 leading-relaxed">
                    <strong>Cabinet is in Simulation Mode.</strong> Clicks will be logged in the
                    activity panel but no webhooks will be fired. This is great for testing the UI
                    without triggering hardware actions.
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Separator className="bg-border/60" />

          {/* Scanner */}
          <ScannerStatusSection />

          <Separator className="bg-border/60" />

          {/* Smart Filters */}
          <SmartFilterCollectionCreator />

          <Separator className="bg-border/60" />

          {/* PC Status Settings */}
          <Section
            title="PC Status Monitoring"
            description="Link Home Assistant entities to the dashboard meters for CPU, RAM, and Online status."
          >
            <div className="grid sm:grid-cols-2 gap-6">
              <Field label="PC Hostname" hint="Shown at the top of the right panel.">
                <Input
                  value={config.pcHostname}
                  onChange={(e) => setConfig({ pcHostname: e.target.value })}
                  placeholder="GAMING-PC"
                  className="font-mono text-sm"
                  data-testid="input-pc-hostname"
                />
              </Field>
              <Field label="Online Entity ID" hint="binary_sensor showing if PC is up.">
                <Input
                  value={config.pcOnlineEntityId}
                  onChange={(e) => setConfig({ pcOnlineEntityId: e.target.value })}
                  placeholder="binary_sensor.gaming_pc_status"
                  className="font-mono text-sm"
                  data-testid="input-pc-online-id"
                />
              </Field>
              <Field label="CPU Entity ID" hint="sensor providing percentage value.">
                <Input
                  value={config.pcCpuEntityId}
                  onChange={(e) => setConfig({ pcCpuEntityId: e.target.value })}
                  placeholder="sensor.gaming_pc_cpu_usage"
                  className="font-mono text-sm"
                  data-testid="input-pc-cpu-id"
                />
              </Field>
              <Field label="RAM Entity ID" hint="sensor providing percentage value.">
                <Input
                  value={config.pcRamEntityId}
                  onChange={(e) => setConfig({ pcRamEntityId: e.target.value })}
                  placeholder="sensor.gaming_pc_ram_usage"
                  className="font-mono text-sm"
                  data-testid="input-pc-ram-id"
                />
              </Field>
              <Field label="Current App Entity ID" hint="sensor showing foreground window.">
                <Input
                  value={config.pcAppEntityId}
                  onChange={(e) => setConfig({ pcAppEntityId: e.target.value })}
                  placeholder="sensor.gaming_pc_current_app"
                  className="font-mono text-sm"
                  data-testid="input-pc-app-id"
                />
              </Field>
            </div>
          </Section>

          <Separator className="bg-border/60" />

          {/* Endpoints */}
          <Section
            title="Webhook Endpoints"
            description="URLs automatically generated for your Home Assistant automations. Copy these to use as Webhook triggers."
          >
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-sidebar/20">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Wifi className="size-4 text-primary" />
                  System Actions
                </h3>
                <div className="grid gap-3">
                  {[
                    { id: "wake_pc", label: "Wake PC", default: "/api/webhook/cabinet_wake_pc" },
                    { id: "sleep_pc", label: "Sleep PC", default: "/api/webhook/cabinet_sleep_pc" },
                    { id: "restart_pc", label: "Restart PC", default: "/api/webhook/cabinet_restart_pc" },
                    { id: "shutdown_pc", label: "Shutdown PC", default: "/api/webhook/cabinet_shutdown_pc" },
                  ].map((a) => (
                    <div key={a.id} className="space-y-1.5">
                      <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                        {a.label}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={config.endpoints[a.id] || a.default}
                          onChange={(e) => setEndpoint(a.id, e.target.value)}
                          className="font-mono text-[12px] bg-background/40"
                          data-testid={`input-endpoint-${a.id}`}
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => copy(config.endpoints[a.id] || a.default, a.id)}
                          data-testid={`button-copy-${a.id}`}
                        >
                          {copied === a.id ? (
                            <Check className="size-3.5 text-accent" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-sidebar/20">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Terminal className="size-4 text-primary" />
                  Sample Game Launch
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Each game has a unique webhook. Example for a specific title:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value="/api/webhook/cabinet_launch_super-mario-world"
                    className="font-mono text-[12px] bg-background/40 opacity-70"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() =>
                      copy("/api/webhook/cabinet_launch_super-mario-world", "sample-game")
                    }
                  >
                    {copied === "sample-game" ? (
                      <Check className="size-3.5 text-accent" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Separator className="bg-border/60" />

          {/* Wiring Guide */}
          <Section
            title="Wiring Guide"
            description="Follow these steps to connect Cabinet Bridge to your physical hardware using Home Assistant."
          >
            <ul className="space-y-6">
              <Step n={1} title="Create a Wake-on-LAN Script">
                Define a script in HA that sends a magic packet to your PC's MAC address.
                <Code>{`script:
  wake_gaming_pc:
    alias: "Wake Gaming PC"
    sequence:
      - service: wake_on_lan.send_magic_packet
        data:
          mac: "AA:BB:CC:DD:EE:FF"`}</Code>
              </Step>
              <Step n={2} title="Setup the Webhook Automation">
                Create an automation that triggers on the `cabinet_wake_pc` webhook and runs your
                script.
                <Code>{`automation:
  - alias: "Cabinet: Wake PC"
    trigger:
      - platform: webhook
        webhook_id: cabinet_wake_pc
    action:
      - service: script.wake_gaming_pc`}</Code>
              </Step>
              <Step n={3} title="Configure PC Sensors">
                Install the <strong>HASS.Agent</strong> or <strong>IOT Link</strong> on your Windows
                PC to provide CPU, RAM, and Online sensors back to Home Assistant.
              </Step>
              <Step n={4} title="Enable Live Mode">
                Scroll up and toggle <strong>Live Mode</strong>. Cabinet Bridge will now send a POST
                request to your HA webhooks whenever you click an action button.
              </Step>
              <Step n={5} title="Add as Sidebar Item (Optional)">
                Add this to your `configuration.yaml` to see Cabinet Bridge in the HA sidebar:
                <Code>{`panel_iframe:
  cabinet:
    title: "Cabinet"
    icon: mdi:gamepad-variant
    url: "${window.location.origin}${window.location.pathname}"`}</Code>
              </Step>
            </ul>
          </Section>

          <Separator className="bg-border/60" />

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <ShieldAlert className="size-3.5" />
              Settings are saved automatically to the local database.
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              data-testid="button-reset-settings"
            >
              <RotateCcw className="size-3.5" /> Reset to Defaults
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

const ALL_SYSTEMS = [
  { id: "nes", label: "NES" }, { id: "snes", label: "SNES" },
  { id: "genesis", label: "Genesis" }, { id: "n64", label: "N64" },
  { id: "gb", label: "GB" }, { id: "gbc", label: "GBC" },
  { id: "gba", label: "GBA" }, { id: "nds", label: "NDS" },
  { id: "ps1", label: "PS1" }, { id: "ps2", label: "PS2" },
  { id: "psp", label: "PSP" }, { id: "dreamcast", label: "DC" },
  { id: "arcade", label: "Arcade" },
];
const ALL_STATUSES = [
  { id: "unset", label: "Unset" }, { id: "playing", label: "Playing" },
  { id: "beaten", label: "Beaten" }, { id: "completed", label: "Completed" },
];

function SmartFilterCollectionCreator() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [systems, setSystems] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [minMinutes, setMinMinutes] = useState<number>(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [genre, setGenre] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleCreate = async () => {
    if (!name.trim()) return;
    const rules: SmartFilterRules = {};
    if (systems.length)  rules.systems = systems;
    if (statuses.length) rules.playStatus = statuses;
    if (minRating > 0)   rules.minRating = minRating;
    if (minMinutes > 0)  rules.minMinutesPlayed = minMinutes;
    if (favoritesOnly)   rules.favorites = true;
    if (genre.trim())    rules.genre = genre.trim();

    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/collections/smart", { name: name.trim(), rules });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Error");
      await queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: "Smart filter created", description: `"${name.trim()}" will update automatically.` });
      setOpen(false);
      setName(""); setSystems([]); setStatuses([]);
      setMinRating(0); setMinMinutes(0); setFavoritesOnly(false); setGenre("");
    } catch (err) {
      toast({ title: "Failed to create", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Smart filter collections"
      description="Collections that auto-populate based on rules — system, play status, rating, or playtime. They update whenever your library changes.">
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}
          className="gap-1.5" data-testid="button-create-smart-filter">
          <Sparkles className="size-3.5" /> New smart filter
        </Button>
      ) : (
        <div className="rounded-xl border border-border bg-black/30 p-4 space-y-4">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Collection name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Currently Playing"
              data-testid="input-smart-filter-name"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Systems <span className="opacity-50">(empty = all)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SYSTEMS.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setSystems((s) => toggle(s, id))}
                  className={`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all ${
                    systems.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Play status <span className="opacity-50">(empty = any)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setStatuses((s) => toggle(s, id))}
                  className={`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all ${
                    statuses.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min rating (0 = any)</Label>
              <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-2 font-mono text-xs text-foreground"
                data-testid="select-smart-filter-min-rating">
                <option value={0}>Any</option>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min playtime</Label>
              <select value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-2 font-mono text-xs text-foreground">
                <option value={0}>Any</option>
                <option value={10}>10 min</option>
                <option value={60}>1 hour</option>
                <option value={300}>5 hours</option>
                <option value={1200}>20 hours</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Genre contains</Label>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. RPG" className="font-mono text-xs"
                data-testid="input-smart-filter-genre" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch id="sf-favorites" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
              <Label htmlFor="sf-favorites" className="text-sm">Favorites only</Label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleCreate} disabled={!name.trim() || saving} className="gap-1.5"
              data-testid="button-save-smart-filter">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Create
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

interface ScannerStatusData {
  enabled: boolean;
  watchDir: string | null;
  lastScanAt: number | null;
  lastScanFound: number;
  totalScanned: number;
  watching: boolean;
  error: string | null;
}

function ScannerStatusSection() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const { data: status } = useQuery<ScannerStatusData>({
    queryKey: ["/api/scanner/status"],
    refetchInterval: 30_000,
  });

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await apiRequest("POST", "/api/scanner/scan-now");
      await queryClient.invalidateQueries({ queryKey: ["/api/scanner/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      toast({ title: "Scan complete", description: `Found ${status?.lastScanFound ?? 0} new ROM(s).` });
    } catch (err) {
      toast({ title: "Scan failed", description: String(err), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  if (!status?.enabled) {
    return (
      <Section title="ROM scanner"
        description="Auto-import ROMs dropped into a watched folder. Set CABINET_ROM_WATCH_DIR in your HA add-on environment to enable.">
        <p className="text-sm text-muted-foreground">
          Not active — set{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">CABINET_ROM_WATCH_DIR</code>{" "}
          in the add-on config to enable automatic ROM imports.
        </p>
      </Section>
    );
  }

  return (
    <Section title="ROM scanner"
      description="Auto-imports new ROM files found in the watched folder every 60 seconds.">
      <div className="space-y-3">
        <div className="flex items-center gap-x-3 gap-y-1 text-sm font-mono">
          <span className="text-muted-foreground">Watch dir:</span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{status.watchDir}</code>
          {status.watching && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" /> Active
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground font-mono">
          <span>Total imported: <span className="text-foreground">{status.totalScanned}</span></span>
          {status.lastScanAt ? (
            <span>Last scan: <span className="text-foreground">{new Date(status.lastScanAt).toLocaleTimeString()}</span></span>
          ) : null}
          {(status.lastScanFound ?? 0) > 0 && (
            <span className="text-primary">+{status.lastScanFound} last run</span>
          )}
        </div>

        {status.error ? (
          <p className="text-xs text-destructive font-mono">{status.error}</p>
        ) : null}

        <Button variant="outline" size="sm" onClick={handleScanNow} disabled={scanning}
          className="gap-1.5" data-testid="button-scan-now">
          {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <ScanLine className="size-3.5" />}
          Scan now
        </Button>
      </div>
    </Section>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4 max-w-prose">{description}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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
    <pre className="mt-2 rounded-md border border-border bg-background/60 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/90 max-w-full">
      <code>{children}</code>
    </pre>
  );
}
