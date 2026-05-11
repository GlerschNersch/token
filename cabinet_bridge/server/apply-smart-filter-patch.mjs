#!/usr/bin/env node
/**
 * apply-smart-filter-patch.mjs
 *
 * Wires up Smart Filter collections:
 *   1. storage.ts  — migration + listCollections() update + new methods
 *   2. routes.ts   — POST /api/collections/smart, PATCH /api/collections/:id/smart
 *   3. Settings.tsx — SmartFilterCollectionCreator component in Library tab
 *
 * Run once from cabinet_bridge/:
 *   node server/apply-smart-filter-patch.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function applyPatch(label, filePath, oldStr, newStr) {
  let src = readFileSync(filePath, "utf8");
  const checkStr = newStr.trimStart().slice(0, 50);
  if (src.includes(checkStr)) {
    console.log(`⏭  ${label} already applied.`);
    return;
  }
  if (!src.includes(oldStr)) {
    console.error(`✗  ${label} — anchor not found, skipping.`);
    return;
  }
  writeFileSync(filePath, src.replace(oldStr, newStr), "utf8");
  console.log(`✓  ${label}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. storage.ts
// ═══════════════════════════════════════════════════════════════════════════
const storagePath = resolve(root, "server/storage.ts");

// 1a: import SmartFilterRules
applyPatch(
  "storage.ts import SmartFilterRules",
  storagePath,
  `  InsertUser,
} from '@shared/schema';`,
  `  InsertUser,
  SmartFilterRules,
} from '@shared/schema';`,
);

// 1b: DB migration
{
  let src = readFileSync(storagePath, "utf8");
  const NEEDLE = `  "ALTER TABLE game_collections ADD COLUMN smart_filter TEXT",`;
  if (src.includes(NEEDLE)) {
    console.log("⏭  storage.ts migration already present.");
  } else {
    // Insert before the per-user save state comment
    const ANCHOR = `  // Per-user save state isolation`;
    if (!src.includes(ANCHOR)) {
      console.error("✗  storage.ts migration anchor not found.");
    } else {
      src = src.replace(ANCHOR, NEEDLE + "\n  " + ANCHOR);
      writeFileSync(storagePath, src, "utf8");
      console.log("✓  storage.ts migration for smart_filter column.");
    }
  }
}

// 1c: update listCollections() + add new methods
applyPatch(
  "storage.ts listCollections + smart filter methods",
  storagePath,
  `  async listCollections(): Promise<GameCollectionWithItems[]> {
    const collections = db.select().from(gameCollections).orderBy(desc(gameCollections.createdAt)).all();
    const items = db.select().from(collectionItems).all();
    return collections.map((collection) => ({
      ...collection,
      romIds: items
        .filter((item) => item.collectionId === collection.id)
        .map((item) => item.romId),
    }));
  }`,
  `  async listCollections(): Promise<GameCollectionWithItems[]> {
    const collections = db.select().from(gameCollections).orderBy(desc(gameCollections.createdAt)).all();
    const items = db.select().from(collectionItems).all();
    const roms = db.select().from(uploadedRoms).all();
    return collections.map((collection) => {
      if (collection.smartFilter) {
        try {
          const rules = JSON.parse(collection.smartFilter) as SmartFilterRules;
          const romIds = roms
            .filter((rom) => {
              if (rules.systems?.length && !rules.systems.includes(rom.system)) return false;
              if (rules.playStatus?.length && !rules.playStatus.includes(rom.playStatus ?? "unset")) return false;
              if (rules.minRating !== undefined && (rom.rating ?? 0) < rules.minRating) return false;
              if (rules.minMinutesPlayed !== undefined && (rom.minutesPlayed ?? 0) < rules.minMinutesPlayed) return false;
              if (rules.favorites && !rom.favorite) return false;
              if (rules.genre && !(rom.genre ?? "").toLowerCase().includes(rules.genre.toLowerCase())) return false;
              return true;
            })
            .map((rom) => rom.id);
          return { ...collection, romIds, smartFilter: rules };
        } catch {
          return { ...collection, romIds: [] };
        }
      }
      return {
        ...collection,
        romIds: items
          .filter((item) => item.collectionId === collection.id)
          .map((item) => item.romId),
      };
    });
  }

  async createSmartFilterCollection(name: string, rules: SmartFilterRules): Promise<GameCollection> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/, "") + "-" + Date.now().toString(36);
    return sqlite.prepare(
      "INSERT INTO game_collections (name, slug, created_at, smart_filter) VALUES (?,?,?,?) RETURNING *"
    ).get(name, slug, Date.now(), JSON.stringify(rules)) as GameCollection;
  }

  async updateSmartFilterCollection(id: number, rules: SmartFilterRules): Promise<GameCollection | undefined> {
    return sqlite.prepare(
      "UPDATE game_collections SET smart_filter=? WHERE id=? RETURNING *"
    ).get(JSON.stringify(rules), id) as GameCollection | undefined;
  }`,
);

// 1d: IStorage interface
applyPatch(
  "storage.ts IStorage smart filter methods",
  storagePath,
  `  addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;`,
  `  addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  createSmartFilterCollection(name: string, rules: SmartFilterRules): Promise<GameCollection>;
  updateSmartFilterCollection(id: number, rules: SmartFilterRules): Promise<GameCollection | undefined>;`,
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. routes.ts
// ═══════════════════════════════════════════════════════════════════════════
const routesPath = resolve(root, "server/routes.ts");

applyPatch(
  "routes.ts smart filter endpoints",
  routesPath,
  `  app.put("/api/collections/:id/roms/:romId", async (req, res) => {`,
  `  // ── Smart filter collections ────────────────────────────────────────────
  const smartFilterRulesSchema = z.object({
    systems:          z.array(z.string().max(32)).optional(),
    playStatus:       z.array(z.string().max(32)).optional(),
    minRating:        z.number().int().min(0).max(5).optional(),
    minMinutesPlayed: z.number().int().min(0).optional(),
    favorites:        z.boolean().optional(),
    genre:            z.string().max(128).optional(),
  });

  app.post("/api/collections/smart", express.json(), async (req, res) => {
    const parsed = z.object({
      name:  z.string().trim().min(1).max(48),
      rules: smartFilterRulesSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid smart filter payload." });
    }
    const collection = await storage.createSmartFilterCollection(parsed.data.name, parsed.data.rules);
    const all = await storage.listCollections();
    const withItems = all.find((c) => c.id === collection.id) ?? { ...collection, romIds: [] };
    return res.status(201).json(withItems);
  });

  app.patch("/api/collections/:id/smart", express.json(), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = smartFilterRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid smart filter rules." });
    }
    const updated = await storage.updateSmartFilterCollection(id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Collection not found." });
    }
    const all = await storage.listCollections();
    const withItems = all.find((c) => c.id === id) ?? { ...updated, romIds: [] };
    return res.json(withItems);
  });

  app.put("/api/collections/:id/roms/:romId", async (req, res) => {`,
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Settings.tsx
// ═══════════════════════════════════════════════════════════════════════════
const settingsPath = resolve(root, "client/src/pages/Settings.tsx");

// 3a: add SmartFilterRules to shared/schema import
applyPatch(
  "Settings.tsx import SmartFilterRules",
  settingsPath,
  `import type { UploadedRom, GameCollectionWithItems, UserProfile } from "@shared/schema";`,
  `import type { UploadedRom, GameCollectionWithItems, UserProfile, SmartFilterRules } from "@shared/schema";`,
);

// 3b: add Sparkles to lucide imports (Filter might already be present)
{
  let src = readFileSync(settingsPath, "utf8");
  if (src.includes("Sparkles")) {
    console.log("⏭  Settings.tsx Sparkles import already present.");
  } else {
    // Add Sparkles before the closing brace of the lucide import
    src = src.replace(
      /} from "lucide-react";/,
      `, Sparkles } from "lucide-react";`,
    );
    writeFileSync(settingsPath, src, "utf8");
    console.log("✓  Settings.tsx Sparkles added to lucide imports.");
  }
}

// 3c: insert <SmartFilterCollectionCreator /> after the Collections section
// Anchor: the end of the Collections Section just before the Metadata import section
applyPatch(
  "Settings.tsx SmartFilterCollectionCreator usage",
  settingsPath,
  `              <Section title="Metadata import"`,
  `              <SmartFilterCollectionCreator />

              <Section title="Metadata import"`,
);

// 3d: insert the SmartFilterCollectionCreator component before the Section helper
const COMPONENT_CODE = `
// ── Smart filter collection creator ──────────────────────────────────────────

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
      toast({ title: "Smart filter created", description: \`"\${name.trim()}" will update automatically.\` });
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

          {/* Systems */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Systems <span className="opacity-50">(empty = all)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SYSTEMS.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setSystems((s) => toggle(s, id))}
                  className={\`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all \${
                    systems.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }\`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Play status */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Play status <span className="opacity-50">(empty = any)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setStatuses((s) => toggle(s, id))}
                  className={\`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all \${
                    statuses.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }\`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Row: min rating + min played */}
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

          {/* Genre + favorites */}
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

`;

applyPatch(
  "Settings.tsx SmartFilterCollectionCreator component",
  settingsPath,
  `function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {`,
  COMPONENT_CODE + `function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {`,
);

console.log("\n✅  Smart filter patch complete.");
console.log("   Run from cabinet_bridge/: node server/apply-smart-filter-patch.mjs");
