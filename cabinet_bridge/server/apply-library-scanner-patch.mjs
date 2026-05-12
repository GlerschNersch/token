#!/usr/bin/env node
/**
 * apply-library-scanner-patch.mjs
 *
 * Wires up the enhanced NAS/Library scanner (scanner.ts v2):
 *
 *   1. shared/schema.ts — adds nasWatchPaths to integrationSettingsSchema
 *   2. routes.ts        — passes getNasPaths callback to initScanner,
 *                         adds GET /api/scanner/detect-platforms,
 *                         updates POST /api/scanner/scan-now to refresh NAS paths,
 *                         adds PUT /api/scanner/nas-paths
 *   3. Settings.tsx     — replaces ScannerStatusSection with the enhanced
 *                         NasLibrarySection that shows all paths, per-path
 *                         stats, and an "Add NAS path" form
 *
 * Run once from cabinet_bridge/:
 *   node server/apply-library-scanner-patch.mjs
 *
 * Idempotent — safe to run multiple times.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function applyPatch(label, filePath, oldStr, newStr) {
  let src = readFileSync(filePath, "utf8");
  const check = newStr.trimStart().slice(0, 60);
  if (src.includes(check)) {
    console.log(`⏭  ${label} already applied.`);
    return;
  }
  if (!src.includes(oldStr)) {
    console.error(`✗  ${label} — anchor not found in ${filePath}, skipping.`);
    return;
  }
  writeFileSync(filePath, src.replace(oldStr, newStr), "utf8");
  console.log(`✓  ${label}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. shared/schema.ts — add nasWatchPaths to integrationSettingsSchema
// ═══════════════════════════════════════════════════════════════════════════
const schemaPath = resolve(root, "shared/schema.ts");

applyPatch(
  "schema.ts nasWatchPaths field",
  schemaPath,
  `  systemDisplay: z.record(z.string(), z.object({`,
  `  nasWatchPaths: z.array(z.string().max(2048)).default([]),
  systemDisplay: z.record(z.string(), z.object({`,
);

applyPatch(
  "schema.ts DEFAULT_INTEGRATION_SETTINGS nasWatchPaths",
  schemaPath,
  `  systemDisplay: {},
};`,
  `  systemDisplay: {},
  nasWatchPaths: [],
};`,
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. routes.ts — enhanced scanner wiring
// ═══════════════════════════════════════════════════════════════════════════
const routesPath = resolve(root, "server/routes.ts");

// 2a: Replace the old scanner init block with the enhanced one
applyPatch(
  "routes.ts scanner init (enhanced)",
  routesPath,
  `  // ── ROM scanner init ───────────────────────────────────────────────────────────
  const CABINET_ROM_WATCH_DIR = process.env.CABINET_ROM_WATCH_DIR;
  if (CABINET_ROM_WATCH_DIR) {
    scanner.initScanner(
      CABINET_ROM_WATCH_DIR,
      (rom) => storage.addScannedRom(rom),
      ()    => storage.listRomFilenames(),
    );
    console.log(\`[Scanner] Watching \${CABINET_ROM_WATCH_DIR} for new ROMs (60s poll).\`);
  }`,
  `  // ── ROM scanner init (v2 — multi-path + NAS) ─────────────────────────────────
  const CABINET_ROM_WATCH_DIR = process.env.CABINET_ROM_WATCH_DIR ?? "";
  const getNasPaths = async () => {
    const s = await storage.getIntegrationSettings();
    return (s as { nasWatchPaths?: string[] }).nasWatchPaths ?? [];
  };
  scanner.initScanner(
    CABINET_ROM_WATCH_DIR,
    (rom)  => storage.addScannedRom(rom),
    ()     => storage.listRomFilenames(),
    getNasPaths,
  );
  if (CABINET_ROM_WATCH_DIR) {
    console.log(\`[Scanner] Watching \${CABINET_ROM_WATCH_DIR} for new ROMs (60s poll).\`);
  } else {
    console.log("[Scanner] No CABINET_ROM_WATCH_DIR set — NAS paths only (if configured).");
  }`,
);

// 2b: Add detect-platforms + nas-paths endpoints
applyPatch(
  "routes.ts detect-platforms + nas-paths endpoints",
  routesPath,
  `  app.put("/api/collections/:id/roms/:romId", async (req, res) => {`,
  `  // ── Library scanner extras ───────────────────────────────────────────────────
  app.get("/api/scanner/detect-platforms", (req, res) => {
    const rootPath = String(req.query.rootPath ?? "").trim();
    if (!rootPath) { res.status(400).json({ message: "rootPath query param required" }); return; }
    try {
      const folders = scanner.detectPlatformFolders(rootPath);
      res.json({ rootPath, folders });
    } catch (err) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.put("/api/scanner/nas-paths", async (req, res) => {
    const { paths } = req.body as { paths?: string[] };
    if (!Array.isArray(paths)) { res.status(400).json({ message: "paths array required" }); return; }
    const current = await storage.getIntegrationSettings();
    const updated = await storage.saveIntegrationSettings({ ...current, nasWatchPaths: paths } as typeof current);
    scanner.refreshNasPaths(async () => {
      const s = await storage.getIntegrationSettings();
      return (s as { nasWatchPaths?: string[] }).nasWatchPaths ?? [];
    });
    res.json({ ok: true, nasWatchPaths: (updated as { nasWatchPaths?: string[] }).nasWatchPaths ?? [] });
  });

  app.put("/api/collections/:id/roms/:romId", async (req, res) => {`,
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Settings.tsx — enhanced NasLibrarySection
// ═══════════════════════════════════════════════════════════════════════════
const settingsPath = resolve(root, "client/src/pages/Settings.tsx");

// 3a: Add FolderOpen + Plus + Trash2 to lucide-react imports
{
  let src = readFileSync(settingsPath, "utf8");
  const needed = ["FolderOpen", "Plus", "Trash2", "Server"];
  let changed = false;
  for (const icon of needed) {
    if (!src.includes(icon)) {
      src = src.replace(/} from "lucide-react";/, `, ${icon} } from "lucide-react";`);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(settingsPath, src, "utf8");
    console.log("✓  Settings.tsx lucide icons (FolderOpen, Plus, Trash2, Server) added.");
  } else {
    console.log("⏭  Settings.tsx lucide icons already present.");
  }
}

// 3b: Replace old <ScannerStatusSection /> with <NasLibrarySection />
{
  let src = readFileSync(settingsPath, "utf8");
  if (src.includes("<NasLibrarySection />")) {
    console.log("⏭  Settings.tsx NasLibrarySection usage already present.");
  } else {
    src = src.replace("<ScannerStatusSection />", "<NasLibrarySection />");
    writeFileSync(settingsPath, src, "utf8");
    console.log("✓  Settings.tsx NasLibrarySection usage inserted.");
  }
}

// 3c: Replace old ScannerStatusSection component definition with NasLibrarySection
const OLD_SCANNER_COMPONENT_START = `// ── ROM scanner status ────────────────────────────────────────────────────────`;

const NAS_LIBRARY_COMPONENT = `
// ── NAS / Library scanner ────────────────────────────────────────────────────

interface ScannerStatusData {
  enabled: boolean;
  watchDir: string | null;
  watchPaths: string[];
  lastScanAt: number | null;
  lastScanFound: number;
  totalScanned: number;
  watching: boolean;
  error: string | null;
  pathStats: Record<string, { found: number; error: string | null }>;
}

function NasLibrarySection() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [addingPath, setAddingPath] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery<ScannerStatusData>({
    queryKey: ["/api/scanner/status"],
    refetchInterval: 30_000,
  });

  // Load current NAS paths from integration settings
  const { data: integrationData } = useQuery<{ nasWatchPaths?: string[] }>({
    queryKey: ["/api/settings/integration"],
  });
  const nasPaths: string[] = integrationData?.nasWatchPaths ?? [];

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await apiRequest("POST", "/api/scanner/scan-now");
      await queryClient.invalidateQueries({ queryKey: ["/api/scanner/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      toast({ title: "Scan complete", description: \`Found \${status?.lastScanFound ?? 0} new ROM(s).\` });
    } catch (err) {
      toast({ title: "Scan failed", description: String(err), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleAddPath = async () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    setAddingPath(true);
    try {
      await apiRequest("PUT", "/api/scanner/nas-paths", { paths: [...nasPaths, trimmed] });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings/integration"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/scanner/status"] });
      setNewPath("");
      toast({ title: "Path added", description: trimmed });
    } catch (err) {
      toast({ title: "Failed to add path", description: String(err), variant: "destructive" });
    } finally {
      setAddingPath(false);
    }
  };

  const handleRemovePath = async (p: string) => {
    try {
      await apiRequest("PUT", "/api/scanner/nas-paths", { paths: nasPaths.filter((x) => x !== p) });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings/integration"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/scanner/status"] });
      toast({ title: "Path removed" });
    } catch (err) {
      toast({ title: "Failed to remove path", description: String(err), variant: "destructive" });
    }
  };

  const activePaths = status?.watchPaths ?? nasPaths;
  const hasAnyPath = activePaths.length > 0 || nasPaths.length > 0;

  return (
    <Section
      title="NAS / Library scanner"
      description="Auto-import ROMs from local or network-mounted paths. Scans recursively every 60 s and infers the system from subfolder names (e.g. /roms/snes/).">
      <div className="space-y-4">

        {/* Active paths list */}
        {nasPaths.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Watch paths</p>
            {nasPaths.map((p) => {
              const stat = status?.pathStats?.[p];
              return (
                <div key={p} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <Server className="size-3.5 shrink-0 text-muted-foreground" />
                  <code className="flex-1 text-xs font-mono truncate">{p}</code>
                  {stat && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {stat.error
                        ? <span className="text-destructive">{stat.error.slice(0, 40)}</span>
                        : \`+\${stat.found} last scan\`}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemovePath(p)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={\`Remove \${p}\`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Env var path (read-only display) */}
        {process.env.NODE_ENV !== "production" && status?.watchDir && !nasPaths.includes(status.watchDir) && (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2">
            <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="flex-1 text-xs font-mono truncate text-muted-foreground">{status.watchDir}</code>
            <span className="text-[10px] text-muted-foreground">(env)</span>
          </div>
        )}

        {/* Add path */}
        <div className="flex gap-2">
          <input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPath()}
            placeholder="/mnt/nas/roms  or  /media/usb/roms"
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm font-mono"
          />
          <Button
            variant="outline" size="sm"
            onClick={handleAddPath}
            disabled={!newPath.trim() || addingPath}
            className="gap-1.5 shrink-0">
            <Plus className="size-3.5" />
            Add path
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground font-mono border-t pt-3">
          <span>
            Total imported:{" "}
            <span className="text-foreground">{status?.totalScanned ?? 0}</span>
          </span>
          {status?.lastScanAt ? (
            <span>
              Last scan:{" "}
              <span className="text-foreground">
                {new Date(status.lastScanAt).toLocaleTimeString()}
              </span>
            </span>
          ) : null}
          {(status?.lastScanFound ?? 0) > 0 && (
            <span className="text-primary">+{status!.lastScanFound} last run</span>
          )}
          {status?.watching && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" /> Active
            </span>
          )}
        </div>

        {status?.error && (
          <p className="text-xs text-destructive font-mono">{status.error}</p>
        )}

        {!hasAnyPath && (
          <p className="text-sm text-muted-foreground">
            No paths configured. Add a path above, or set{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">CABINET_ROM_WATCH_DIR</code>{" "}
            in your add-on environment.
          </p>
        )}

        <Button
          variant="outline" size="sm"
          onClick={handleScanNow}
          disabled={scanning || !hasAnyPath}
          className="gap-1.5">
          {scanning
            ? <Loader2 className="size-3.5 animate-spin" />
            : <ScanLine className="size-3.5" />}
          Scan now
        </Button>
      </div>
    </Section>
  );
}

`;

// Find the old ScannerStatusSection block and replace with NasLibrarySection
{
  let src = readFileSync(settingsPath, "utf8");
  if (src.includes("function NasLibrarySection()")) {
    console.log("⏭  Settings.tsx NasLibrarySection component already present.");
  } else if (src.includes(OLD_SCANNER_COMPONENT_START)) {
    // Find start and end of the old component (ends just before `function Section(`)
    const startIdx = src.indexOf(OLD_SCANNER_COMPONENT_START);
    const endMarker = `function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {`;
    const endIdx = src.indexOf(endMarker);
    if (endIdx === -1) {
      console.error("✗  Settings.tsx — could not find Section function, skipping component replacement.");
    } else {
      const before = src.slice(0, startIdx);
      const after  = src.slice(endIdx);
      writeFileSync(settingsPath, before + NAS_LIBRARY_COMPONENT + after, "utf8");
      console.log("✓  Settings.tsx NasLibrarySection component inserted (replaced ScannerStatusSection).");
    }
  } else {
    // No existing scanner section at all — insert before Section
    applyPatch(
      "Settings.tsx NasLibrarySection component (fresh insert)",
      settingsPath,
      `function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {`,
      NAS_LIBRARY_COMPONENT + `function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {`,
    );
  }
}

console.log("\n✅  Library scanner patch complete.");
console.log("   Run: cd cabinet_bridge && node server/apply-library-scanner-patch.mjs");
console.log("   Then rebuild / restart dev server.");
