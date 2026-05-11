#!/usr/bin/env node
/**
 * apply-settings-appearance-patch.mjs
 *
 * Adds a dedicated Appearance tab to Settings.tsx:
 *   • Moves the inline theme section out of the General tab
 *   • Adds a top-level "Appearance" tab with the theme picker
 *   • Adds Palette to the lucide-react import
 *
 * Run once from cabinet_bridge/:
 *   node server/apply-settings-appearance-patch.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, "../client/src/pages/Settings.tsx");

let src = readFileSync(TARGET, "utf8");

// ── Patch 1: add Palette to lucide imports ────────────────────────────────────────────
const P1_OLD = 'Pencil, Monitor, Vibrate } from "lucide-react";';
const P1_NEW = 'Pencil, Monitor, Vibrate, Palette } from "lucide-react";';

if (src.includes(P1_NEW)) {
  console.log("⏭  Patch 1 already applied (Palette import).");
} else if (!src.includes(P1_OLD)) {
  console.error("✗  Patch 1 anchor not found — skipping.");
} else {
  src = src.replace(P1_OLD, P1_NEW);
  console.log("✓  Patch 1: Palette added to lucide-react imports.");
}

// ── Patch 2: add Appearance tab trigger ───────────────────────────────────────────
const P2_OLD = `              <TabsTrigger value="ha" className="text-xs sm:text-sm">HA Setup</TabsTrigger>
            </TabsList>`;
const P2_NEW = `              <TabsTrigger value="ha" className="text-xs sm:text-sm">HA Setup</TabsTrigger>
              <TabsTrigger value="appearance" className="text-xs sm:text-sm">Appearance</TabsTrigger>
            </TabsList>`;

if (src.includes(P2_NEW)) {
  console.log("⏭  Patch 2 already applied (Appearance tab trigger).");
} else if (!src.includes(P2_OLD)) {
  console.error("✗  Patch 2 anchor not found — skipping.");
} else {
  src = src.replace(P2_OLD, P2_NEW);
  console.log("✓  Patch 2: Appearance tab trigger added to TabsList.");
}

// ── Patch 3: remove inline Appearance section from General tab ────────────────────
const P3_START = `
              <Section title="Appearance" description="Choose a colour theme. Saved in the browser.">`;
const P3_END_MARKER = `

              <ProfilesSection />`;

if (!src.includes(P3_START)) {
  console.log("⏭  Patch 3 already applied (inline Appearance section absent).");
} else {
  const startIdx = src.indexOf(P3_START);
  const endIdx   = src.indexOf(P3_END_MARKER);
  if (endIdx === -1 || endIdx <= startIdx) {
    console.error("✗  Patch 3 end marker not found — skipping.");
  } else {
    src = src.slice(0, startIdx) + src.slice(endIdx);
    console.log("✓  Patch 3: Removed inline Appearance section from General tab.");
  }
}

// ── Patch 4: add Appearance TabsContent block ─────────────────────────────────────────
const P4_ANCHOR = `          </Tabs>
        </div>
      </main>`;

const APPEARANCE_TAB = `
            {/* ── Appearance ──────────────────────────────────────────────────────── */}
            <TabsContent value="appearance" className="space-y-8">
              <Section title="Theme" description="Choose a colour theme. Saved in the browser and applied immediately.">
                {([
                  { group: "Base",
                    themes: [
                      { id: "default",   label: "Default",      swatch: ["#f026ab", "#22d3ee", "#0f0f18"] },
                      { id: "synthwave", label: "Synthwave",     swatch: ["#d946ef", "#06f0e0", "#0b0612"] },
                      { id: "oled",      label: "OLED Black",    swatch: ["#ff2dba", "#06f0e0", "#000000"] },
                      { id: "nord",      label: "Nord",          swatch: ["#81a1c1", "#88c0d0", "#1e222a"] },
                      { id: "amber",     label: "Amber CRT",     swatch: ["#f59e0b", "#fbbf24", "#140e08"] },
                      { id: "dracula",   label: "Dracula",       swatch: ["#bd93f9", "#50fa7b", "#1e1f29"] },
                      { id: "cyberpunk", label: "Cyberpunk",     swatch: ["#e8d510", "#ff2d6b", "#070712"] },
                      { id: "gameboy",   label: "Game Boy",      swatch: ["#4ade80", "#86efac", "#0f1a0a"] },
                    ]},
                  { group: "80s",
                    themes: [
                      { id: "miami-vice",  label: "Miami Vice",    swatch: ["#f43f5e", "#2dd4bf", "#080e1e"] },
                      { id: "c64",         label: "Commodore 64",  swatch: ["#facc15", "#a5b4fc", "#1c1c70"] },
                      { id: "arcade",      label: "Arcade Cabinet",swatch: ["#facc15", "#ef4444", "#0a0a0a"] },
                    ]},
                  { group: "90s",
                    themes: [
                      { id: "vaporwave",   label: "Vaporwave",     swatch: ["#f472b6", "#67e8f9", "#180d25"] },
                      { id: "grunge",      label: "Grunge",        swatch: ["#c2602a", "#6b7c3a", "#131009"] },
                      { id: "win95",       label: "Windows 95",    swatch: ["#00a8cc", "#4169e1", "#191c1e"] },
                      { id: "blockbuster", label: "Blockbuster",   swatch: ["#fbbf24", "#3b82f6", "#06081a"] },
                    ]},
                  { group: "Early 2000s",
                    themes: [
                      { id: "aqua",        label: "Mac OS X Aqua", swatch: ["#0ea5e9", "#f97316", "#141618"] },
                      { id: "y2k",         label: "Y2K Chrome",    swatch: ["#3b82f6", "#ec4899", "#0a0b12"] },
                      { id: "halo",        label: "Halo / Xbox",   swatch: ["#22c55e", "#f59e0b", "#0d1209"] },
                    ]},
                ] as { group: string; themes: { id: AppTheme; label: string; swatch: string[] }[] }[]).map(({ group, themes }) => (
                  <div key={group} className="mb-5 last:mb-0">
                    <p className="md-label-small text-muted-foreground/70 uppercase tracking-[0.1em] mb-2">{group}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {themes.map(({ id, label, swatch }) => (
                        <button key={id} onClick={() => handleTheme(id)} data-testid={\`button-theme-\${id}\`}
                          className={\`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-mono transition-all \${
                            activeTheme === id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40 text-muted-foreground"
                          }\`}>
                          <div className="flex gap-1">
                            {swatch.map((c, i) => (
                              <span key={i} className="size-5 rounded-full border border-white/10" style={{ background: c }} />
                            ))}
                          </div>
                          <span className="text-center leading-tight">{label}</span>
                          {activeTheme === id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            </TabsContent>
`;

if (src.includes('value="appearance" className="space-y-8"')) {
  console.log("⏭  Patch 4 already applied (Appearance TabsContent present).");
} else if (!src.includes(P4_ANCHOR)) {
  console.error("✗  Patch 4 anchor not found — skipping.");
} else {
  src = src.replace(P4_ANCHOR, APPEARANCE_TAB + P4_ANCHOR);
  console.log("✓  Patch 4: Appearance TabsContent added.");
}

writeFileSync(TARGET, src, "utf8");
console.log("\n✅  Settings.tsx updated successfully.");
console.log("   Rebuild / restart the dev server to see the new Appearance tab.");
