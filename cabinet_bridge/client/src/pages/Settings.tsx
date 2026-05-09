import React, { useState, useEffect, useCallback } from "react";
import { THEMES, type AppTheme, applyTheme } from "@/App";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIntegration } from "@/lib/integration";
import { SYSTEMS, formatRomSize } from "@/data/library";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { filterToPath } from "@/lib/filter";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, Trash2, ChevronRight, RotateCcw, Zap, CheckCircle2, XCircle, Loader2, UserCircle2, Plus, X, Gamepad2, Wifi, WifiOff } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConsoleSilhouette } from "@/components/ConsoleSilhouette";
import type { UploadedRom, GameCollectionWithItems, UserProfile } from "@shared/schema";

// ── Control definitions ────────────────────────────────────────────────────

const DEFAULT_KEYS: Record<number, string> = {
  0: "z", 1: "a", 2: "shift", 3: "enter",
  4: "up arrow", 5: "down arrow", 6: "left arrow", 7: "right arrow",
  8: "x", 9: "s", 10: "q", 11: "w",
  12: "e", 13: "r", 14: "tab", 15: "c",
  24: "1", 25: "2", 26: "3",
};

type ButtonDef = { index: number; label: string };

const BUTTON_DEFS: Record<string, ButtonDef[]> = {
  nes: [
    { index: 0, label: "B" }, { index: 1, label: "A" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
  ],
  snes: [
    { index: 0, label: "B" }, { index: 1, label: "Y" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "A" }, { index: 9, label: "X" },
    { index: 10, label: "L" }, { index: 11, label: "R" },
  ],
  segaMD: [
    { index: 0, label: "B" }, { index: 1, label: "A" },
    { index: 2, label: "Mode" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "C" }, { index: 9, label: "Y" },
    { index: 10, label: "X" }, { index: 11, label: "Z" },
  ],
  n64: [
    { index: 0, label: "B" }, { index: 1, label: "A" },
    { index: 2, label: "Z" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 10, label: "R" }, { index: 11, label: "L" },
  ],
  gba: [
    { index: 0, label: "B" }, { index: 1, label: "A (unused)" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "A" }, { index: 10, label: "L" }, { index: 11, label: "R" },
  ],
  gambatte: [
    { index: 0, label: "B" }, { index: 1, label: "A (unused)" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "A" },
  ],
  psx: [
    { index: 0, label: "Cross (✕)" }, { index: 1, label: "Square (□)" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "Circle (○)" }, { index: 9, label: "Triangle (△)" },
    { index: 10, label: "L1" }, { index: 11, label: "R1" },
    { index: 12, label: "L2" }, { index: 13, label: "R2" },
    { index: 14, label: "L3 (stick)" }, { index: 15, label: "R3 (stick)" },
  ],
  pcsx2: [
    { index: 0, label: "Cross (✕)" }, { index: 1, label: "Square (□)" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "Circle (○)" }, { index: 9, label: "Triangle (△)" },
    { index: 10, label: "L1" }, { index: 11, label: "R1" },
    { index: 12, label: "L2" }, { index: 13, label: "R2" },
    { index: 14, label: "L3 (stick)" }, { index: 15, label: "R3 (stick)" },
  ],
  ppsspp: [
    { index: 0, label: "Cross (✕)" }, { index: 1, label: "Square (□)" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "Circle (○)" }, { index: 9, label: "Triangle (△)" },
    { index: 10, label: "L" }, { index: 11, label: "R" },
  ],
  melonds: [
    { index: 0, label: "B" }, { index: 1, label: "Y" },
    { index: 2, label: "Select" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "A" }, { index: 9, label: "X" },
    { index: 10, label: "L" }, { index: 11, label: "R" },
  ],
  reicast: [
    { index: 0, label: "B" }, { index: 1, label: "A" },
    { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 9, label: "Y" }, { index: 10, label: "R" }, { index: 11, label: "L" },
  ],
  mame2003: [
    { index: 0, label: "Button 1" }, { index: 1, label: "Button 2" },
    { index: 2, label: "Coin" }, { index: 3, label: "Start" },
    { index: 4, label: "Up" }, { index: 5, label: "Down" },
    { index: 6, label: "Left" }, { index: 7, label: "Right" },
    { index: 8, label: "Button 3" }, { index: 9, label: "Button 4" },
    { index: 10, label: "Button 5" }, { index: 11, label: "Button 6" },
  ],
};

const HOTKEY_DEFS: ButtonDef[] = [
  { index: 24, label: "Quick Save" },
  { index: 25, label: "Quick Load" },
  { index: 26, label: "Change Save Slot" },
];

const SYSTEMS_WITH_CORES: { systemId: string; label: string; core: string }[] = [
  { systemId: "nes",       label: "NES",            core: "nes" },
  { systemId: "snes",      label: "SNES",           core: "snes" },
  { systemId: "genesis",   label: "Genesis / Mega Drive", core: "segaMD" },
  { systemId: "n64",       label: "Nintendo 64",    core: "n64" },
  { systemId: "gb",        label: "Game Boy",       core: "gambatte" },
  { systemId: "gbc",       label: "Game Boy Color", core: "gambatte" },
  { systemId: "gba",       label: "Game Boy Advance", core: "gba" },
  { systemId: "nds",       label: "Nintendo DS",    core: "melonds" },
  { systemId: "ps1",       label: "PlayStation 1",  core: "psx" },
  { systemId: "ps2",       label: "PlayStation 2",  core: "pcsx2" },
  { systemId: "psp",       label: "PSP",            core: "ppsspp" },
  { systemId: "dreamcast", label: "Dreamcast",      core: "reicast" },
  { systemId: "arcade",    label: "Arcade (MAME)",  core: "mame2003" },
];

function formatKeyLabel(key: string): string {
  const map: Record<string, string> = {
    "up arrow": "↑", "down arrow": "↓", "left arrow": "←", "right arrow": "→",
    "enter": "↩ Enter", "shift": "⇧ Shift", "tab": "⇥ Tab", "escape": "Esc",
    "backspace": "⌫ Bksp", "space": "Space", "control": "Ctrl", "alt": "Alt",
  };
  return map[key.toLowerCase()] ?? key.toUpperCase();
}

function captureKeyName(e: KeyboardEvent): string {
  const map: Record<string, string> = {
    ArrowUp: "up arrow", ArrowDown: "down arrow", ArrowLeft: "left arrow", ArrowRight: "right arrow",
    Enter: "enter", Shift: "shift", Tab: "tab", Escape: "escape",
    Backspace: "backspace", " ": "space", Control: "control", Alt: "alt",
  };
  return map[e.key] ?? e.key.toLowerCase();
}

// ── Controls tab component ─────────────────────────────────────────────────

function ControlsTab() {
  const { config, setConfig } = useIntegration();
  const [selectedSystem, setSelectedSystem] = useState(SYSTEMS_WITH_CORES[0].systemId);
  const [capturing, setCapturing] = useState<number | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number>(1);
  const { toast } = useToast();

  const { data: profiles = [] } = useQuery<UserProfile[]>({ queryKey: ["/api/profiles"] });

  const sys = SYSTEMS_WITH_CORES.find((s) => s.systemId === selectedSystem)!;
  const core = sys.core;
  const defs = BUTTON_DEFS[core] ?? [];
  const saved = config.controlDefaults?.[core] ?? {};

  // Profile-specific bindings override global
  const { data: profileBindings = {} } = useQuery<Record<number, string>>({
    queryKey: ["/api/profiles", selectedProfileId, "controls", core],
    queryFn: async () => {
      if (selectedProfileId === 1) return {};
      const res = await fetch(`/api/profiles/${selectedProfileId}/controls/${core}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: selectedProfileId > 1,
  });

  const getKey = (index: number) => {
    if (selectedProfileId !== 1 && profileBindings[index] !== undefined) return profileBindings[index];
    return saved[index] ?? DEFAULT_KEYS[index] ?? "";
  };

  const setKey = useCallback(async (index: number, key: string) => {
    if (selectedProfileId !== 1) {
      // Save to profile-specific bindings
      const updated = { ...profileBindings, [index]: key };
      await apiRequest("PUT", `/api/profiles/${selectedProfileId}/controls/${core}`, updated);
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles", selectedProfileId, "controls", core] });
    } else {
      const current = config.controlDefaults ?? {};
      const coreMap = { ...(current[core] ?? {}), [index]: key };
      setConfig({ controlDefaults: { ...current, [core]: coreMap } });
    }
  }, [config.controlDefaults, core, selectedProfileId, profileBindings, setConfig]);

  const resetCore = async () => {
    if (selectedProfileId !== 1) {
      await apiRequest("DELETE", `/api/profiles/${selectedProfileId}/controls/${core}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles", selectedProfileId, "controls", core] });
      toast({ title: "Reset", description: `${sys.label} bindings reset for this profile.` });
    } else {
      const current = config.controlDefaults ?? {};
      const next = { ...current };
      delete next[core];
      setConfig({ controlDefaults: next });
    }
  };

  // Key capture listener
  useEffect(() => {
    if (capturing === null) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturing(null); return; }
      setKey(capturing, captureKeyName(e));
      setCapturing(null);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [capturing, setKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold">Input Mapping</h3>
          <p className="text-sm text-muted-foreground">
            Customise keyboard controls per system and per profile. Profile overrides take precedence over global defaults.
          </p>
        </div>

        {/* Profile selector */}
        {profiles.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Profile:</span>
            {[{ id: 1, name: "Global (all profiles)", color: "#6b7280" }, ...profiles].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-all ${
                  selectedProfileId === p.id
                    ? "bg-primary/15 border-primary text-primary"
                    : "bg-background/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: (p as any).color ?? "#6b7280" }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {SYSTEMS_WITH_CORES.map((s) => (
            <button
              key={s.systemId}
              onClick={() => setSelectedSystem(s.systemId)}
              className={`px-3 py-1.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-all ${
                selectedSystem === s.systemId
                  ? "bg-primary/15 border-primary text-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                  : "bg-background/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6 p-4 rounded-xl border border-card-border bg-black/40 backdrop-blur-sm relative overflow-hidden">
        {/* Silhouette background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <ConsoleSilhouette systemId={selectedSystem} />
        </div>

        <div className="space-y-4 relative">
          <div className="aspect-[4/3] rounded-lg border border-white/10 bg-black/40 p-4 flex items-center justify-center relative group">
             <ConsoleSilhouette systemId={selectedSystem} />
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
             <div className="absolute bottom-3 left-3 font-mono text-[9px] uppercase tracking-widest text-white/40">
               {sys.label} Silhouette
             </div>
          </div>
          <Button variant="outline" size="sm" className="w-full font-mono text-[10px] uppercase tracking-wider" onClick={resetCore}>
            <RotateCcw className="size-3 mr-2" /> Reset {sys.label}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 relative">
           {defs.map((d) => {
             const key = getKey(d.index);
             const active = capturing === d.index;
             return (
               <div key={d.index} className="space-y-1.5">
                 <Label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{d.label}</Label>
                 <button
                   onClick={() => setCapturing(d.index)}
                   className={`w-full h-10 px-3 rounded-md border font-mono text-xs text-left transition-all ${
                     active
                       ? "bg-accent/20 border-accent text-accent animate-pulse ring-2 ring-accent/30"
                       : "bg-background/50 border-border text-foreground hover:border-primary/50"
                   }`}
                 >
                   {active ? "Press a key..." : formatKeyLabel(key) || "Not bound"}
                 </button>
               </div>
             );
           })}
        </div>
      </div>
      
      {/* Hotkeys */}
      <div className="space-y-3">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Emulator Hotkeys</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
           {HOTKEY_DEFS.map((d) => {
             const key = getKey(d.index);
             const active = capturing === d.index;
             return (
               <div key={d.index} className="space-y-1.5">
                 <Label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{d.label}</Label>
                 <button
                   onClick={() => setCapturing(d.index)}
                   className={`w-full h-10 px-3 rounded-md border font-mono text-xs text-left transition-all ${
                     active
                       ? "bg-accent/20 border-accent text-accent animate-pulse ring-2 ring-accent/30"
                       : "bg-background/50 border-border text-foreground hover:border-primary/50"
                   }`}
                 >
                   {active ? "Press a key..." : formatKeyLabel(key) || "Not bound"}
                 </button>
               </div>
             );
           })}
        </div>
      </div>

      {/* Gamepad remapper */}
      <GamepadRemapSection profileId={selectedProfileId} />
    </div>
  );
}


// ── Gamepad remapper ────────────────────────────────────────────────────────

const RETROPAD_BUTTONS: { index: number; label: string; group: string }[] = [
  { index: 8,  label: "A (East)",   group: "Face" },
  { index: 0,  label: "B (South)",  group: "Face" },
  { index: 9,  label: "X (North)",  group: "Face" },
  { index: 1,  label: "Y (West)",   group: "Face" },
  { index: 3,  label: "Start",      group: "System" },
  { index: 2,  label: "Select",     group: "System" },
  { index: 4,  label: "D-Pad Up",   group: "D-Pad" },
  { index: 5,  label: "D-Pad Down", group: "D-Pad" },
  { index: 6,  label: "D-Pad Left", group: "D-Pad" },
  { index: 7,  label: "D-Pad Right","group": "D-Pad" },
  { index: 10, label: "L1",         group: "Shoulder" },
  { index: 11, label: "R1",         group: "Shoulder" },
  { index: 12, label: "L2",         group: "Shoulder" },
  { index: 13, label: "R2",         group: "Shoulder" },
  { index: 14, label: "L3 (Click)", group: "Analog" },
  { index: 15, label: "R3 (Click)", group: "Analog" },
];

// Standard Xbox/PS gamepad default mapping (retropad → physical button index)
const DEFAULT_GAMEPAD_MAP: Record<number, number> = {
  8: 0, 0: 1, 9: 2, 1: 3,   // A→0, B→1, X→2, Y→3
  2: 8, 3: 9,                 // Select→8, Start→9
  4: 12, 5: 13, 6: 14, 7: 15,// D-pad
  10: 4, 11: 5, 12: 6, 13: 7,// Shoulders
  14: 10, 15: 11,             // Sticks
};

function physicalButtonLabel(idx: number): string {
  const names: Record<number, string> = {
    0: "A", 1: "B", 2: "X", 3: "Y",
    4: "LB/L1", 5: "RB/R1", 6: "LT/L2", 7: "RT/R2",
    8: "Back/Select", 9: "Start/Menu",
    10: "L3", 11: "R3",
    12: "↑", 13: "↓", 14: "←", 15: "→",
  };
  return names[idx] !== undefined ? `Button ${idx} (${names[idx]})` : `Button ${idx}`;
}

function GamepadRemapSection({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [capturingBtn, setCapturingBtn] = useState<number | null>(null);
  const [bindings, setBindings] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState(false);
  const rafRef = React.useRef<number | null>(null);
  const prevBtns = React.useRef<boolean[]>([]);

  // Refresh gamepad list
  const refreshGamepads = React.useCallback(() => {
    const pads = Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[];
    setGamepads(pads);
  }, []);

  React.useEffect(() => {
    window.addEventListener("gamepadconnected", refreshGamepads);
    window.addEventListener("gamepaddisconnected", refreshGamepads);
    refreshGamepads();
    return () => {
      window.removeEventListener("gamepadconnected", refreshGamepads);
      window.removeEventListener("gamepaddisconnected", refreshGamepads);
    };
  }, [refreshGamepads]);

  // Load saved bindings for this profile
  React.useEffect(() => {
    fetch(`/api/profiles/${profileId}/gamepad-bindings/default`)
      .then((r) => r.json())
      .then((data: Record<number, number>) => {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          setBindings(data);
        } else {
          setBindings({ ...DEFAULT_GAMEPAD_MAP });
        }
      })
      .catch(() => setBindings({ ...DEFAULT_GAMEPAD_MAP }));
  }, [profileId]);

  // Polling loop for button capture
  React.useEffect(() => {
    if (capturingBtn === null) {
      prevBtns.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const poll = () => {
      const pads = Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[];
      const pad = pads[0];
      if (!pad) { rafRef.current = requestAnimationFrame(poll); return; }

      const curr = pad.buttons.map((b) => b.pressed);
      // Detect newly pressed button (not pressed on previous frame)
      for (let i = 0; i < curr.length; i++) {
        if (curr[i] && !(prevBtns.current[i] ?? false)) {
          setBindings((prev) => ({ ...prev, [capturingBtn]: i }));
          setCapturingBtn(null);
          prevBtns.current = [];
          return;
        }
      }
      prevBtns.current = curr;
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [capturingBtn]);

  const saveBindings = async () => {
    try {
      await apiRequest("PUT", `/api/profiles/${profileId}/gamepad-bindings/default`, bindings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Gamepad mapping saved", description: "Applied on next game launch." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const resetBindings = () => {
    setBindings({ ...DEFAULT_GAMEPAD_MAP });
  };

  const groups = Array.from(new Set(RETROPAD_BUTTONS.map((b) => b.group)));

  return (
    <div className="space-y-5 pt-6 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="size-4 text-primary" />
          <h3 className="font-display text-lg font-bold">Gamepad Mapping</h3>
        </div>
        <div className="flex items-center gap-2">
          {gamepads.length > 0 ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-green-400">
              <Wifi className="size-3" /> {gamepads[0].id.slice(0, 28)}{gamepads[0].id.length > 28 ? "…" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <WifiOff className="size-3" /> No controller detected
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Map each RetroArch button to a physical button on your controller.
        {gamepads.length === 0 && " Plug in a controller to use the press-to-capture feature."}
      </p>

      {capturingBtn !== null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/15 border border-accent text-accent font-mono text-sm animate-pulse">
          <Gamepad2 className="size-4 shrink-0" />
          Press the physical button for <strong className="mx-1">{RETROPAD_BUTTONS.find((b) => b.index === capturingBtn)?.label}</strong> — or{" "}
          <button onClick={() => setCapturingBtn(null)} className="underline">cancel</button>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group} className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-1">{group}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {RETROPAD_BUTTONS.filter((b) => b.group === group).map((btn) => {
                const physIdx = bindings[btn.index];
                const isCapturing = capturingBtn === btn.index;
                return (
                  <button
                    key={btn.index}
                    onClick={() => gamepads.length > 0 ? setCapturingBtn(btn.index) : undefined}
                    disabled={gamepads.length === 0}
                    className={[
                      "flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all",
                      isCapturing
                        ? "bg-accent/20 border-accent ring-2 ring-accent/40 animate-pulse"
                        : gamepads.length > 0
                          ? "bg-card border-border hover:border-primary/60 cursor-pointer"
                          : "bg-card/50 border-border/50 cursor-default opacity-60",
                    ].join(" ")}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{btn.label}</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {isCapturing ? "Waiting…" : physIdx !== undefined ? physicalButtonLabel(physIdx) : "Not mapped"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={saveBindings} size="sm" className="font-mono text-[11px] uppercase tracking-wider">
          {saved ? <><Check className="size-3 mr-2" />Saved!</> : "Save Gamepad Map"}
        </Button>
        <Button onClick={resetBindings} variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-wider">
          <RotateCcw className="size-3 mr-2" /> Reset to Default
        </Button>
      </div>
    </div>
  );
}

// ── Main Settings page ─────────────────────────────────────────────────────

export default function Settings() {
  const { config, setConfig, resetConfig, saveStatus } = useIntegration();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<AppTheme>(
    () => (localStorage.getItem("ha-theme") as AppTheme | null) ?? "default"
  );
  const handleTheme = (t: AppTheme) => { applyTheme(t); setActiveTheme(t); };

  const [esImporting, setEsImporting] = useState(false);
  const [esResult, setEsResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [esError, setEsError] = useState<string | null>(null);
  const [lbImporting, setLbImporting] = useState(false);
  const [lbResult, setLbResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [lbError, setLbError] = useState<string | null>(null);

  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({ queryKey: ["/api/collections"] });

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1200); }
    catch { /* ignore */ }
  };

  return (
    <div className="flex h-full">
      <Sidebar active="favorites" />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto pb-20 lg:pb-0" data-testid="page-settings">
        <MobileTopBar active="favorites" />
        <div className="px-4 sm:px-10 py-5 sm:py-10 max-w-4xl w-full mx-auto">
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
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-1">
            Settings
          </h1>

          <div
            className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
            data-testid="text-settings-save-status"
          >
            <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${
              saveStatus === "saving" ? "bg-amber-400 animate-pulse"
              : saveStatus === "saved" ? "bg-status-online"
              : saveStatus === "error" ? "bg-destructive"
              : "bg-muted-foreground/40"
            }`} />
            {saveStatus === "loading" ? "Loading…"
              : saveStatus === "saving" ? "Saving…"
              : saveStatus === "saved" ? "Saved"
              : saveStatus === "error" ? "Save failed"
              : "Settings sync to add-on storage"}
          </div>

          <Tabs defaultValue="general">
            <TabsList className="mb-6 w-full grid grid-cols-3 sm:flex sm:flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
              <TabsTrigger value="library" className="text-xs sm:text-sm">Library</TabsTrigger>
              <TabsTrigger value="services" className="text-xs sm:text-sm">Services</TabsTrigger>
              <TabsTrigger value="controls" className="text-xs sm:text-sm">Controls</TabsTrigger>
              <TabsTrigger value="kiosk" className="text-xs sm:text-sm">Kiosk</TabsTrigger>
              <TabsTrigger value="ha" className="text-xs sm:text-sm">HA Setup</TabsTrigger>
            </TabsList>

            {/* ── General ──────────────────────────────────────────────── */}
            <TabsContent value="general" className="space-y-8">
              <Section title="Home Assistant connection" description="Where HomeArcade sends its requests. The base URL is only needed when Live mode is on.">
                <Field label="Home Assistant base URL" hint="e.g. https://homeassistant.local:8123">
                  <Input type="url" value={config.haBaseUrl} onChange={(e) => setConfig({ haBaseUrl: e.target.value })}
                    placeholder="https://homeassistant.local:8123" data-testid="input-ha-base" />
                </Field>
                <Field label="Long-lived access token (optional)" hint="Only required for /api/services/* calls. Webhook endpoints are unauthenticated by design.">
                  <Input type="password" value={config.haToken} onChange={(e) => setConfig({ haToken: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIs…" data-testid="input-ha-token" autoComplete="off" />
                </Field>
                <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3">
                  <Switch id="live-mode" checked={config.liveMode} onCheckedChange={(v) => setConfig({ liveMode: !!v })} data-testid="switch-live-mode" />
                  <div className="flex-1">
                    <Label htmlFor="live-mode" className="font-medium text-sm">Live mode</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When off, every action is logged as a simulation. Turn on once your HA webhooks are configured.
                    </p>
                  </div>
                </div>
                {config.liveMode && (
                  <div className="flex items-start gap-2 rounded-md border border-chart-3/40 bg-chart-3/10 px-3 py-2 text-xs" data-testid="banner-live">
                    <AlertTriangle className="size-4 mt-0.5 text-chart-3 shrink-0" />
                    <span>Live mode is on — buttons will issue real <code>POST</code> requests.</span>
                  </div>
                )}
              </Section>

              <Section title="Appearance" description="Choose a colour theme. Saved in the browser.">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { id: "default",   label: "Default",   swatch: ["#f026ab", "#22d3ee", "#0f0f18"] },
                    { id: "synthwave", label: "Synthwave",  swatch: ["#d946ef", "#06f0e0", "#0b0612"] },
                    { id: "gameboy",   label: "Game Boy",   swatch: ["#4ade80", "#86efac", "#0f1a0a"] },
                    { id: "oled",      label: "OLED Black", swatch: ["#ff2dba", "#06f0e0", "#000000"] },
                  ] as { id: AppTheme; label: string; swatch: string[] }[]).map(({ id, label, swatch }) => (
                    <button key={id} onClick={() => handleTheme(id)} data-testid={`button-theme-${id}`}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-mono transition-all ${
                        activeTheme === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
                      }`}>
                      <div className="flex gap-1">
                        {swatch.map((c, i) => <span key={i} className="size-5 rounded-full border border-white/10" style={{ background: c }} />)}
                      </div>
                      <span>{label}</span>
                      {activeTheme === id && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active</span>}
                    </button>
                  ))}
                </div>
              </Section>

              <ProfilesSection />

              <Section title="Reset" description="Clear all locally saved settings.">
                <Button variant="outline" onClick={() => resetConfig()} data-testid="button-reset-config">Reset to defaults</Button>
              </Section>

              <Section title="Help &amp; feedback" description="Found a bug or have a feature request?">
                <div className="flex flex-wrap gap-3">
                  <a href="https://github.com/GlerschNersch/token/issues/new" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                    data-testid="link-report-issue">
                    <AlertTriangle className="size-4 text-yellow-500" /> Report an issue <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                  <a href="https://github.com/GlerschNersch/token" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                    View on GitHub <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                </div>
              </Section>
            </TabsContent>

            {/* ── Library ──────────────────────────────────────────────── */}
            <TabsContent value="library" className="space-y-8">
              <RomLibrarySection />

              <Section title="Game launch endpoints"
                description="HomeArcade derives a webhook URL for each uploaded ROM. Register these in Home Assistant to wire up automations or voice commands.">
                <div className="rounded-md border border-border bg-background/40 overflow-hidden">
                  <table className="w-full text-sm" data-testid="table-launch-endpoints">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>
                        <th className="text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2">Game</th>
                        <th className="hidden sm:table-cell text-left font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2">Endpoint</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {uploadedRoms.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">Upload ROMs to generate launch endpoints.</td></tr>
                      ) : uploadedRoms.map((rom) => {
                        const ep = `/api/webhook/cabinet_launch_${rom.slug}`;
                        return (
                          <tr key={rom.id}>
                            <td className="px-3 py-2">
                              <div className="truncate max-w-[180px] sm:max-w-none">{rom.title}</div>
                              <div className="sm:hidden font-mono text-[11px] text-muted-foreground break-all mt-0.5">POST {ep}</div>
                            </td>
                            <td className="hidden sm:table-cell px-3 py-2 font-mono text-[12px] text-foreground/80 break-all">POST {ep}</td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" onClick={() => copy(ep, `rom-${rom.id}`)} aria-label={`Copy ${rom.title} endpoint`}
                                data-testid={`button-copy-rom-endpoint-${rom.id}`} className="text-muted-foreground hover:text-foreground">
                                {copied === `rom-${rom.id}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Metadata import"
                description="Import game metadata from an EmulationStation gamelist.xml or a LaunchBox platform XML.">
                <div className="rounded-md border border-border bg-background/40 p-3">
                  <Label className="text-sm font-medium">EmulationStation / Batocera / RetroPie</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">Upload a gamelist.xml file.</p>
                  <input type="file" accept=".xml,text/xml,application/xml" data-testid="input-es-xml"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-mono file:uppercase file:tracking-wide file:cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setEsImporting(true); setEsResult(null); setEsError(null);
                      try {
                        const res = await fetch("/api/import/emulationstation", { method: "POST", headers: { "Content-Type": "application/xml" }, body: await file.arrayBuffer() });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || "Import failed");
                        setEsResult({ imported: data.imported, skipped: data.skipped });
                        await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
                      } catch (err) { setEsError(String(err)); }
                      finally { setEsImporting(false); e.target.value = ""; }
                    }} />
                  {esImporting && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
                  {esResult && <p className="text-xs text-status-online mt-2" data-testid="text-es-import-result">✓ Imported {esResult.imported} game{esResult.imported !== 1 ? "s" : ""}, skipped {esResult.skipped}.</p>}
                  {esError && <p className="text-xs text-destructive mt-2" data-testid="text-es-import-error">{esError}</p>}
                </div>
                <div className="rounded-md border border-border bg-background/40 p-3">
                  <Label className="text-sm font-medium">LaunchBox</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">Upload a platform XML from your LaunchBox Data/Platforms folder.</p>
                  <input type="file" accept=".xml,text/xml,application/xml" data-testid="input-lb-xml"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-mono file:uppercase file:tracking-wide file:cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setLbImporting(true); setLbResult(null); setLbError(null);
                      try {
                        const res = await fetch("/api/import/launchbox", { method: "POST", headers: { "Content-Type": "application/xml" }, body: await file.arrayBuffer() });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || "Import failed");
                        setLbResult({ imported: data.imported, skipped: data.skipped });
                        await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
                      } catch (err) { setLbError(String(err)); }
                      finally { setLbImporting(false); e.target.value = ""; }
                    }} />
                  {lbImporting && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
                  {lbResult && <p className="text-xs text-status-online mt-2" data-testid="text-lb-import-result">✓ Imported {lbResult.imported} game{lbResult.imported !== 1 ? "s" : ""}, skipped {lbResult.skipped}.</p>}
                  {lbError && <p className="text-xs text-destructive mt-2" data-testid="text-lb-import-error">{lbError}</p>}
                </div>
              </Section>
            </TabsContent>

            {/* ── Services ─────────────────────────────────────────────── */}
            <TabsContent value="services" className="space-y-8">
              <Section title="TheGamesDB (recommended)"
                description="Primary metadata source — box art, descriptions, genre, developer, and publisher. Free API key at thegamesdb.net (sign up → API Key).">
                <Field label="TheGamesDB API Key" hint="Register at thegamesdb.net to get a free key.">
                  <Input type="password" value={config.tgdbApiKey ?? ""} onChange={(e) => setConfig({ tgdbApiKey: e.target.value })}
                    placeholder="••••••••" autoComplete="off" />
                </Field>
              </Section>

              <Section title="ScreenScraper.fr (optional)"
                description="Fallback metadata source. Excellent retro coverage. Register free at screenscraper.fr.">
                <Field label="ScreenScraper user ID" hint="Your screenscraper.fr username.">
                  <Input type="text" value={config.ssUserId ?? ""} onChange={(e) => setConfig({ ssUserId: e.target.value })}
                    placeholder="your_username" data-testid="input-ss-userid" autoComplete="off" />
                </Field>
                <Field label="ScreenScraper password" hint="Your screenscraper.fr password.">
                  <Input type="password" value={config.ssPassword ?? ""} onChange={(e) => setConfig({ ssPassword: e.target.value })}
                    placeholder="••••••••" data-testid="input-ss-password" autoComplete="off" />
                </Field>
              </Section>

              <Section title="RetroAchievements (optional)"
                description="Earn achievements for classic games. Register free at retroachievements.org.">
                <Field label="RA Username" hint="Your retroachievements.org username.">
                  <Input type="text" value={config.raUsername ?? ""} onChange={(e) => setConfig({ raUsername: e.target.value })}
                    placeholder="your_ra_username" data-testid="input-ra-username" autoComplete="off" />
                </Field>
                <Field label="RA API Token" hint="Found under Settings → Keys on retroachievements.org.">
                  <Input type="password" value={config.raToken ?? ""} onChange={(e) => setConfig({ raToken: e.target.value })}
                    placeholder="••••••••" data-testid="input-ra-token" autoComplete="off" />
                </Field>
              </Section>
            </TabsContent>

            {/* ── Controls ─────────────────────────────────────────────── */}
            <TabsContent value="controls">
              <ControlsTab />
            </TabsContent>

            {/* ── Kiosk ────────────────────────────────────────────────── */}
            <TabsContent value="kiosk" className="space-y-8">
              <Section title="Kiosk / Arcade mode"
                description="Lock the UI to a specific collection, hide upload and settings, and optionally require a PIN to exit.">
                <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3">
                  <Switch id="kiosk-mode" checked={config.kioskMode ?? false} onCheckedChange={(v) => setConfig({ kioskMode: !!v })} data-testid="switch-kiosk-mode" />
                  <div className="flex-1">
                    <Label htmlFor="kiosk-mode" className="font-medium text-sm">Enable kiosk mode</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Hides upload, settings, and management UI. Refresh after changing.</p>
                  </div>
                </div>
                <Field label="Exit PIN (optional)" hint="4–8 digit PIN to leave kiosk mode. Leave blank for no PIN.">
                  <Input type="password" inputMode="numeric" maxLength={8}
                    value={config.kioskPin ?? ""} onChange={(e) => setConfig({ kioskPin: e.target.value.replace(/\D/g, "") })}
                    placeholder="e.g. 1234" data-testid="input-kiosk-pin" autoComplete="off" />
                </Field>
                <Field label="Locked collection (optional)" hint="Kiosk mode shows only games from this collection.">
                  <select value={config.kioskCollectionId ?? ""} onChange={(e) => setConfig({ kioskCollectionId: e.target.value ? Number(e.target.value) : null })}
                    data-testid="select-kiosk-collection"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">— Show all games —</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </Section>
            </TabsContent>

            {/* ── HA Setup ─────────────────────────────────────────────── */}
            <TabsContent value="ha" className="space-y-8">
              <Section title="Now Playing sensor"
                description="HomeArcade exposes a live endpoint so Home Assistant can display what's currently running.">
                <p className="text-xs text-muted-foreground">Add a <code>rest</code> sensor to your <code>configuration.yaml</code>:</p>
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
                  Optionally create an <code>input_text.homearcade_now_playing</code> helper — HomeArcade will update it automatically.
                </p>
                <Code>{`input_text:
  homearcade_now_playing:
    name: HomeArcade Now Playing
    max: 100`}</Code>
              </Section>

              <Section title="Lovelace card"
                description="Add HomeArcade as a card to your HA dashboard with now-playing status and a recent games shelf.">
                <ol className="space-y-4 list-none p-0 m-0">
                  <Step n={1} title="Copy the card file">
                    Place <code>homearcade-card.js</code> in your HA <code>/config/www/</code> folder.
                    <Code>{`wget -O /config/www/homearcade-card.js \\
  http://homeassistant.local:7860/homearcade-card.js`}</Code>
                  </Step>
                  <Step n={2} title="Register the resource">
                    Go to <strong>Settings → Dashboards → Resources → Add</strong>:
                    <Code>{`URL:  /local/homearcade-card.js\nType: JavaScript Module`}</Code>
                  </Step>
                  <Step n={3} title="Add the card">
                    <strong>Add Card → Manual</strong>:
                    <Code>{`type: custom:homearcade-card\ntitle: HomeArcade\nbase_url: http://homeassistant.local:7860\nmax_recent: 6`}</Code>
                  </Step>
                </ol>
                <div className="mt-3">
                  <a href="/homearcade-card.js" download="homearcade-card.js"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline" data-testid="link-download-card">
                    <ExternalLink className="size-3.5" /> Download homearcade-card.js
                  </a>
                </div>
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RomLibrarySection() {
  const { toast } = useToast();
  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });

  // ── Per-ROM scrape ────────────────────────────────────────────────────────
  const scrape = useMutation({
    mutationFn: async (rom: UploadedRom) => {
      const res = await apiRequest("POST", `/api/roms/${rom.id}/scrape-art`);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { message?: string }).message ?? `Error ${res.status}`); }
      return (await res.json()) as UploadedRom;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      if (!data.artUrl) toast({ title: "No art found", description: "ScreenScraper couldn't match this ROM.", variant: "destructive" });
    },
    onError: (err: Error) => toast({ title: "Art scrape failed", description: err.message, variant: "destructive" }),
  });

  const deleteRom = useMutation({
    mutationFn: async (rom: UploadedRom) => {
      const res = await apiRequest("DELETE", `/api/roms/${rom.id}`);
      return (await res.json()) as { deleted: boolean };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/roms"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/collections"] }),
      ]);
    },
  });

  // ── Bulk scrape ───────────────────────────────────────────────────────────
  type ScrapeResult = { id: number; title: string; status: string };
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkCurrent, setBulkCurrent] = useState("");
  const [bulkResults, setBulkResults] = useState<ScrapeResult[]>([]);
  const [bulkDone, setBulkDone] = useState<{ matched: number; failed: number; total: number } | null>(null);

  const unmatched = roms.filter((r) => r.scrapeStatus !== "matched").length;

  const startBulkScrape = useCallback((force = false) => {
    setBulkRunning(true);
    setBulkDone(null);
    setBulkResults([]);
    setBulkIndex(0);
    setBulkTotal(0);
    setBulkCurrent("Starting…");

    const url = apiUrl("/api/roms/scrape-all") + (force ? "?force=1" : "");
    // Use fetch+ReadableStream for POST with SSE
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) })
      .then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop()!;
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "start") { setBulkTotal(ev.total); }
              if (ev.type === "progress") { setBulkIndex(ev.index); setBulkCurrent(ev.title); }
              if (ev.type === "result") {
                setBulkResults((prev) => [...prev, { id: ev.id, title: ev.title, status: ev.status }]);
              }
              if (ev.type === "done") {
                setBulkDone({ matched: ev.matched, failed: ev.failed, total: ev.total });
                setBulkRunning(false);
                queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
              }
            } catch { /* ignore malformed */ }
          }
        }
      })
      .catch((err) => {
        setBulkRunning(false);
        toast({ title: "Scrape failed", description: String(err), variant: "destructive" });
      });
  }, [toast]);

  const pct = bulkTotal > 0 ? Math.round((bulkIndex / bulkTotal) * 100) : 0;

  return (
    <Section title="ROM library" description="Manage uploaded ROMs. Upload new ones from each system's page.">
      {/* ── Bulk art scrape ── */}
      <div className="rounded-md border border-border bg-background/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Art scraper</div>
            <p className="text-sm mt-0.5">
              {bulkDone
                ? `Done — ${bulkDone.matched} matched, ${bulkDone.failed} not found`
                : bulkRunning
                ? `Scraping ${bulkIndex + 1} of ${bulkTotal}…`
                : unmatched > 0
                ? `${unmatched} ROM${unmatched === 1 ? "" : "s"} without art`
                : "All ROMs have art"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline" size="sm"
              onClick={() => startBulkScrape(false)}
              disabled={bulkRunning || unmatched === 0}
              data-testid="button-scrape-all"
            >
              {bulkRunning ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Zap className="size-3.5 mr-1.5" />}
              {bulkRunning ? "Scraping…" : "Scrape missing"}
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => startBulkScrape(true)}
              disabled={bulkRunning || roms.length === 0}
              data-testid="button-scrape-all-force"
              title="Re-scrape every ROM including those already matched"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {(bulkRunning || bulkDone) && (
          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${bulkDone ? 100 : pct}%` }}
              />
            </div>
            {bulkRunning && (
              <p className="font-mono text-[10px] text-muted-foreground truncate">
                {bulkCurrent}
              </p>
            )}
          </div>
        )}

        {/* Results scroll list */}
        {bulkResults.length > 0 && (
          <div className="max-h-36 overflow-y-auto space-y-0.5 rounded border border-border bg-background/60 p-2">
            {bulkResults.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px] font-mono">
                {r.status === "matched"
                  ? <CheckCircle2 className="size-3 shrink-0 text-green-500" />
                  : <XCircle className="size-3 shrink-0 text-muted-foreground" />}
                <span className="truncate text-muted-foreground">{r.title}</span>
                <span className={`ml-auto shrink-0 ${r.status === "matched" ? "text-green-500" : "text-muted-foreground/60"}`}>
                  {r.status === "matched" ? "matched" : "not found"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-background/40 p-4" data-testid="rom-upload-redirect">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Where to upload</div>
        <p className="text-sm mt-1 max-w-prose">
          Open a system from the sidebar —{" "}
          <Link href={filterToPath("ps1")} className="text-primary hover:underline" data-testid="link-upload-ps1">PS1</Link>,{" "}
          <Link href={filterToPath("snes")} className="text-primary hover:underline" data-testid="link-upload-snes">SNES</Link>, or{" "}
          <Link href={filterToPath("nes")} className="text-primary hover:underline" data-testid="link-upload-nes">NES</Link>{" "}
          — and you'll find an upload dropzone there.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SYSTEMS.map((s) => (
            <Link key={s.id} href={filterToPath(s.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider hover-elevate"
              data-testid={`link-upload-system-${s.id}`}>
              {s.shortName}<ChevronRight className="size-3" />
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Uploaded library</span>
          <span className="font-mono text-[10px] text-muted-foreground" data-testid="text-uploaded-count">{roms.length} ROM{roms.length === 1 ? "" : "s"}</span>
        </div>
        {roms.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground" data-testid="state-no-roms">No uploaded ROMs yet.</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="list-uploaded-roms">
            {roms.map((rom) => (
              <li key={rom.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`row-rom-${rom.id}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{rom.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    {rom.system.toUpperCase()} · {formatRomSize(rom.size)} · {rom.scrapeStatus === "matched" ? "art matched" : "no art yet"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">cabinet_launch_{rom.slug}</div>
                </div>
                <div className="shrink-0 flex flex-wrap items-center justify-start sm:justify-end gap-2">
                  {rom.artUrl && <img src={rom.artUrl} alt="" className="h-10 w-8 rounded object-cover border border-border" loading="lazy" decoding="async" data-testid={`img-rom-art-${rom.id}`} />}
                  <Button variant="outline" size="sm" onClick={() => scrape.mutate(rom)} disabled={scrape.isPending} data-testid={`button-scrape-rom-${rom.id}`}>
                    {rom.artUrl ? "Refresh art" : "Find art"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={deleteRom.isPending}
                    className="text-destructive hover:text-destructive" data-testid={`button-delete-rom-${rom.id}`}
                    onClick={() => { if (window.confirm(`Delete ${rom.title}?`)) deleteRom.mutate(rom); }}>
                    <Trash2 className="size-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {deleteRom.isError && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{(deleteRom.error as Error).message}</div>}
      {deleteRom.isSuccess && <div className="rounded-md border border-status-online/40 bg-status-online/10 px-3 py-2 text-xs text-status-online">ROM removed.</div>}
    </Section>
  );
}

// ── Profiles section ──────────────────────────────────────────────────────
const PROFILE_COLORS = ["#8b5cf6","#ec4899","#06b6d4","#10b981","#f59e0b","#ef4444","#6366f1","#84cc16"];

function ProfilesSection() {
  const { toast } = useToast();
  const { data: profiles = [], refetch } = useQuery<UserProfile[]>({ queryKey: ["/api/profiles"] });
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PROFILE_COLORS[0]);
  const [adding, setAdding] = useState(false);

  const createProfile = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await apiRequest("POST", "/api/profiles", { name, color: newColor });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      setNewName("");
      toast({ title: "Profile created", description: `"${name}" is ready to use.` });
    } catch {
      toast({ title: "Failed to create profile", variant: "destructive" });
    } finally { setAdding(false); }
  };

  const deleteProfile = async (id: number) => {
    if (id === 1) { toast({ title: "Cannot delete the default profile", variant: "destructive" }); return; }
    try {
      await apiRequest("DELETE", `/api/profiles/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: "Profile deleted" });
    } catch {
      toast({ title: "Failed to delete profile", variant: "destructive" });
    }
  };

  return (
    <Section title="Player profiles" description="Create separate profiles to keep save states, cheats, and key remaps independent. Switch profiles from the library header.">
      <div className="flex flex-col gap-2">
        {profiles.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2">
            <span className="size-3 rounded-full shrink-0" style={{ background: p.color }} />
            <UserCircle2 className="size-4 text-muted-foreground shrink-0" />
            <span className="flex-1 font-mono text-sm">{p.name}</span>
            {p.id === 1 && <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Default</span>}
            {p.id !== 1 && (
              <button type="button" onClick={() => deleteProfile(p.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                title="Delete profile">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 mt-2">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">New profile name</label>
          <Input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void createProfile(); }}
            placeholder="e.g. Player 2" className="font-mono text-sm" data-testid="input-new-profile-name" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Colour</label>
          <div className="flex gap-1.5">
            {PROFILE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: newColor === c ? "white" : "transparent" }}
                title={c} />
            ))}
          </div>
        </div>
        <Button onClick={() => void createProfile()} disabled={!newName.trim() || adding}
          className="gap-1.5" data-testid="button-create-profile">
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
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
      <span className="shrink-0 size-6 rounded-full bg-arcade-gradient text-white font-mono text-[12px] font-bold flex items-center justify-center">{n}</span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-sm">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground/80">{children}</div>
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
