import { useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useIntegration } from "@/lib/integration";
import { QUICK_ACTIONS, SYSTEMS, formatRomSize } from "@/data/library";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, Upload, FileArchive, Trash2, FolderOpen, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UploadedRom } from "@shared/schema";

export default function Settings() {
  const { config, setConfig, setEndpoint } = useIntegration();
  const [copied, setCopied] = useState<string | null>(null);
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
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
      <Sidebar active="favorites" onSelect={() => undefined} />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto" data-testid="page-settings">
        <MobileTopBar active="favorites" onSelect={() => undefined} />

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
            Cabinet Bridge calls your Home Assistant instance, which in turn runs the
            scripts that wake, launch, or shut down the emulator PC. This panel records
            the URLs Cabinet Bridge will hit. In the prototype, calls are simulated unless
            you toggle Live mode below.
          </p>

          <Section
            title="Connection"
            description="Where Cabinet Bridge sends its requests. The base URL is only used when Live mode is on."
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

          <RomUploadSection />

          <Section
            title="Game launch endpoints"
            description={`Cabinet Bridge derives launch URLs as /api/webhook/cabinet_launch_<slug>. These mappings come from your uploaded ROM library.`}
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
              <Step n={3} title="Point Cabinet Bridge at HA">
                Fill the base URL above. Cabinet Bridge will POST to
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
    url: https://cabinet-bridge.example.com
    require_admin: false`}
                </Code>
                Or use a Lovelace iframe card. Cabinet Bridge does not store any data in
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

          <Section title="Reset" description="Clear all overrides set in this session.">
            <Button
              variant="outline"
              onClick={() =>
                setConfig({
                  haBaseUrl: "https://homeassistant.local:8123",
                  haToken: "",
                  liveMode: false,
                  endpoints: {},
                })
              }
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

function RomUploadSection() {
  const [system, setSystem] = useState("nes");
  const [favorite, setFavorite] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: roms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });

  const mergeFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("Choose one or more ROM files first.");
      const uploaded: UploadedRom[] = [];
      for (const romFile of files) {
        const res = await apiRequest(
          "POST",
          `/api/roms/upload?system=${encodeURIComponent(system)}&favorite=${favorite ? "1" : "0"}`,
          romFile,
          {
            headers: {
              "Content-Type": romFile.type || "application/octet-stream",
              "X-ROM-Filename": encodeURIComponent(romFile.name),
            },
          },
        );
        uploaded.push((await res.json()) as UploadedRom);
      }
      return uploaded;
    },
    onSuccess: async () => {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
    },
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
      title="ROM uploads"
      description="Upload cartridge/disc files by console. Uploaded ROMs are added to the library and get a launch webhook slug automatically."
    >
      <div className="rounded-lg border border-border bg-background/40 p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Field label="Console" hint="Choose the system this ROM belongs to.">
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="select-rom-system"
            >
              {SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName} — {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ROM file" hint="Examples: .nes, .sfc, .gba, .z64, .iso, .zip">
            <input
              ref={fileInputRef}
              id="rom-file"
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                mergeFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
              data-testid="input-rom-file"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                mergeFiles(Array.from(e.dataTransfer.files ?? []));
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background/40 hover:border-accent/60 hover:bg-accent/5"
              }`}
              data-testid="dropzone-rom-file"
            >
              <FolderOpen className="size-6 text-accent" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="font-mono uppercase tracking-wider"
                data-testid="button-browse-rom-files"
              >
                Browse ROM files
              </Button>
              <p className="text-[11px] text-muted-foreground">
                <span className="hidden sm:inline">Tap or drag and drop ROM files here. </span>
                <span className="sm:hidden">Tap to choose ROM files. </span>
                Multiple files supported.
              </p>
            </div>
          </Field>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-card/50 p-3">
          <Switch
            id="rom-favorite"
            checked={favorite}
            onCheckedChange={(checked) => setFavorite(!!checked)}
            data-testid="switch-rom-favorite"
          />
          <div>
            <Label htmlFor="rom-favorite" className="font-medium text-sm">
              Add to Favorites
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep this on if you want the uploaded game to appear on the first screen.
            </p>
          </div>
        </div>

        {files.length > 0 ? (
          <div className="rounded-md border border-border bg-card/50 p-3" data-testid="text-selected-rom">
            <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <FileArchive className="size-4 text-accent shrink-0" />
                <span className="truncate">
                  {files.length} file{files.length === 1 ? "" : "s"} selected ·{" "}
                  {formatRomSize(files.reduce((sum, item) => sum + item.size, 0))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground shrink-0"
                data-testid="button-clear-rom-files"
              >
                Clear
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground">
              {files.map((item) => (
                <li key={`${item.name}-${item.size}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {item.name} · {formatRomSize(item.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) =>
                        prev.filter(
                          (f) => !(f.name === item.name && f.size === item.size),
                        ),
                      )
                    }
                    aria-label={`Remove ${item.name}`}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    data-testid={`button-remove-rom-file-${item.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {upload.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="error-rom-upload">
            {(upload.error as Error).message}
          </div>
        ) : null}

        {upload.isSuccess ? (
          <div className="rounded-md border border-status-online/40 bg-status-online/10 px-3 py-2 text-xs text-status-online" data-testid="success-rom-upload">
            ROM upload complete. Return to the library to launch newly added games or copy their webhooks below.
          </div>
        ) : null}

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

        <Button
          onClick={() => upload.mutate()}
          disabled={files.length === 0 || upload.isPending}
          className="font-mono uppercase tracking-wider"
          data-testid="button-upload-rom"
        >
          <Upload className="size-4 mr-2" />
          {upload.isPending
            ? `Uploading ${files.length}…`
            : files.length > 1
            ? `Upload ${files.length} ROMs`
            : "Upload ROM"}
        </Button>
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
            No uploaded ROMs yet. Try uploading your Contra.nes file under NES.
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

      <p className="text-xs text-muted-foreground">
        Prototype note: this uploads through the web app backend. For huge PS1/PS2/Dreamcast images, a production Home Assistant install should usually reference files already stored on your NAS or emulator PC instead of pushing multi-GB files through the browser.
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
