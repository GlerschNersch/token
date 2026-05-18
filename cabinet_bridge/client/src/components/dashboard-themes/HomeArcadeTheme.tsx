import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Fuse from "fuse.js";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, GAMES, SYSTEMS, type Game, type System, type SystemId } from "@/data/library";
import { GameDetailDialog } from "@/components/GameDetailDialog";
import { MobileTopBar } from "@/components/MobileNav";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/queryClient";
import { useIntegration } from "@/lib/integration";
import { useGameDialogState } from "@/lib/useGameDialogState";
import type { UploadedRom, GameCollectionWithItems, RomSaveSlot, GameCheatCode } from "@shared/schema";
import {
  Play,
  Search,
  Settings as SettingsIcon,
  Star,
  ChevronRight,
  ChevronLeft,
  Clock,
  Zap,
  Save,
  Trophy,
  History,
  Folder,
  Plus,
  Loader2,
  ImagePlus,
  Database,
  Check,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Timer,
  Info,
  LayoutGrid,
  Camera,
  QrCode,
  Smartphone,
  Wifi,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useGridNav } from "@/lib/useGridNav";
import { WarpLinkDialog } from "@/components/WarpLinkDialog";

// ─── sub-components ──────────────────────────────────────────────────────────

function SaveSlotCard({
  slot,
  romId,
  onDelete,
}: {
  slot: RomSaveSlot;
  romId: number;
  onDelete: () => void;
}) {
  const [thumbError, setThumbError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const thumbUrl = `/api/roms/${romId}/save-thumb/${slot.slot}`;

  const timeAgo = (() => {
    const diffMs = Date.now() - slot.updatedAt;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  })();

  return (
    <div className="group relative rounded-2xl border border-white/5 bg-white/5 overflow-hidden w-[100px] shrink-0">
      <div className="relative w-full aspect-video bg-neutral-900 flex items-center justify-center">
        {!thumbError ? (
          <img
            src={thumbUrl}
            alt={`Slot ${slot.slot}`}
            className="w-full h-full object-cover"
            onError={() => setThumbError(true)}
            decoding="async"
          />
        ) : (
          <Save className="size-5 text-white/10" />
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {confirming ? (
            <div className="flex flex-col items-center gap-1">
              <button onClick={onDelete} className="text-[8px] font-black uppercase text-red-400">Delete?</button>
              <button onClick={() => setConfirming(false)} className="text-[8px] font-black uppercase text-white/40">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="p-2 bg-black/40 rounded-full text-white/60 hover:text-white">
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="p-2 text-center">
        <div className="font-mono text-[9px] font-bold text-white/80 truncate">{slot.label}</div>
        <div className="font-mono text-[8px] text-white/30 truncate">{timeAgo}</div>
      </div>
    </div>
  );
}

function WarpScanner({
  onScan,
  onClose
}: {
  onScan: (url: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const scanner = new Html5Qrcode("warp-scanner-viewport");
    const config = {
      fps: 20,
      qrbox: { width: 280, height: 280 },
      aspectRatio: 1.0
    };

    scanner.start(
      { facingMode: "environment" },
      config,
      (text) => {
        // Simple check to ensure it's a HomeArcade warp link
        if (text.includes("/api/roms/") && text.includes("warp=true")) {
          scanner.stop().then(() => onScan(text));
        }
      },
      () => {}
    ).catch(err => {
      console.error("Scanner failed", err);
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(e => console.error("Scanner cleanup failed", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm aspect-square relative rounded-3xl overflow-hidden border-2 border-primary shadow-[0_0_50px_rgba(var(--primary),0.3)]">
        <div id="warp-scanner-viewport" className="w-full h-full" />
        {/* Subtle scan guide overlay */}
        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
      </div>
      <p className="mt-8 text-white/60 text-xs font-bold uppercase tracking-widest text-center max-w-[240px]">
        Scan the Warp Link on your PC to continue playing
      </p>
      <Button
        onClick={onClose}
        variant="outline"
        className="mt-12 w-full max-w-xs h-14 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest"
      >
        Cancel Scan
      </Button>
    </div>
  );
}

function CheatRow({
  cheat,
  onToggle,
  onDelete,
}: {
  cheat: GameCheatCode;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <button onClick={onToggle} className="shrink-0 text-white/20 hover:text-white transition-colors">
        {cheat.enabled ? <ToggleRight className="size-5 text-primary" /> : <ToggleLeft className="size-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-mono text-[11px] font-bold truncate ${cheat.enabled ? "text-white" : "text-white/20"}`}>
          {cheat.description}
        </div>
        <div className="font-mono text-[9px] text-white/20 truncate tracking-widest uppercase">
          {cheat.code}
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="text-[9px] font-black uppercase text-red-400">Yes</button>
          <button onClick={() => setConfirming(false)} className="text-[9px] font-black uppercase text-white/40">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="p-2 text-white/10 hover:text-red-400 transition-colors">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

export default function HomeArcadeTheme() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const {
    selectedGame: dialogGame,
    openGame,
    closeGame,
    handleToggleFav,
    handleRate,
    handleCreateCollection,
    handleToggleCollection,
    handleSetStatus,
  } = useGameDialogState();

  // ── All Games (demo + uploaded) ───────────────────────────────────────────────
  const allGames = useMemo(() => {
    const uploaded = roms.map(uploadedRomToGame);
    return [...uploaded, ...GAMES];
  }, [roms]);

  // ── Search + Sort ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "year" | "rating" | "plays">("recent");
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: / or Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredGames = useMemo(() => {
    let list = allGames;
    const systemFilter = searchQuery.startsWith("filter:") ? searchQuery.slice(7).trim() : "";
    if (systemFilter) {
      list = list.filter((g) => g.system === systemFilter);
    } else if (searchQuery.trim()) {
      const fuse = new Fuse(allGames, {
        keys: ["title", "system", "genre", "developer", "publisher"],
        threshold: 0.35,
        distance: 100,
      });
      list = fuse.search(searchQuery.trim()).map((r) => r.item);
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "title": return a.title.localeCompare(b.title);
        case "year": return (a.year || 0) - (b.year || 0);
        case "rating": return (b.rating || 0) - (a.rating || 0);
        case "plays": return (b.minutesPlayed ?? 0) - (a.minutesPlayed ?? 0);
        case "recent":
        default: return (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0);
      }
    });
  }, [allGames, searchQuery, sort]);

  const recentlyPlayed = useMemo(
    () =>
      [...allGames]
        .filter((g) => g.lastPlayed && g.lastPlayed > 0)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 6),
    [allGames],
  );

  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showWarpDialog, setShowWarpDialog] = useState(false);

  const activeGame = filteredGames[activeGameIdx];

  // ── Grid Navigation (Keyboard + Gamepad) ───────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const { focusedIndex, setFocusedIndex } = useGridNav({
    count: filteredGames.length,
    gridRef,
    disabled: !!dialogGame || (window.innerWidth < 1280 && showMobileDetails),
    onActivate: (idx) => {
      if (activeGameIdx === idx) {
        const game = filteredGames[idx];
        const returnTo = encodeURIComponent(window.location.href);
        window.location.href = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
      } else {
        setActiveGameIdx(idx);
        if (window.innerWidth < 1280) setShowMobileDetails(true);
      }
    },
    onFav: (idx) => {
      const game = filteredGames[idx];
      if (game) handleToggleFav(game);
    },
    onFocusChange: (idx) => {
      if (idx >= 0) setActiveGameIdx(idx);
    }
  });

  // Sync manual mouse selection back to grid nav focus
  useEffect(() => {
    if (activeGameIdx !== focusedIndex) setFocusedIndex(activeGameIdx);
  }, [activeGameIdx, focusedIndex, setFocusedIndex]);

  // ── Management Logic ─────────────────────────────────────────────────────────
  const [scrapingArt, setScrapingArt] = useState(false);
  const [cheatDesc, setCheatDesc] = useState("");
  const [cheatCode, setCheatCode] = useState("");
  const [addingCheat, setAddingCheat] = useState(false);
  const [fetchingCheats, setFetchingCheats] = useState(false);
  const [fetchedCheats, setFetchedCheats] = useState<{ desc: string; code: string; selected: boolean }[] | null>(null);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const { data: cheats = [], refetch: refetchCheats } = useQuery<GameCheatCode[]>({
    queryKey: ["cheats", activeGame?.romId, 1],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/roms/${activeGame!.romId}/cheats?profileId=1`));
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeGame?.romId,
  });

  const { data: saveSlots = [], refetch: refetchSlots } = useQuery<RomSaveSlot[]>({
    queryKey: ["save-states", activeGame?.romId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/roms/${activeGame!.romId}/save-states`));
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeGame?.romId,
  });

  const { data: latestSave, refetch: refetchLatestSave } = useQuery<RomSaveSlot | null>({
    queryKey: ["save-states", activeGame?.romId, "latest"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/roms/${activeGame!.romId}/save-states/latest`));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeGame?.romId,
  });

  const { data: raProgress } = useQuery({
    queryKey: ["ra-progress", activeGame?.raGameId],
    queryFn: async () => {
      if (!activeGame?.raGameId) return null;
      const res = await fetch(apiUrl(`/api/retroachievements/user-progress/${activeGame.raGameId}`));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeGame?.raGameId && !!config.raUsername && !!config.raToken,
  });

  const refreshArt = useCallback(async () => {
    if (!activeGame?.romId) return;
    setScrapingArt(true);
    try {
      const res = await apiRequest("POST", `/api/roms/${activeGame.romId}/scrape-art`);
      const data = await res.json() as UploadedRom;
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      toast({ title: "Sector Synchronized", description: data.artUrl ? "Visual assets updated." : "No new data found." });
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Failed", description: String(err) });
    } finally {
      setScrapingArt(false);
    }
  }, [activeGame, toast]);

  const addCheat = async () => {
    if (!activeGame?.romId || !cheatDesc.trim() || !cheatCode.trim()) return;
    setAddingCheat(true);
    try {
      await apiRequest("POST", `/api/roms/${activeGame.romId}/cheats`, {
        description: cheatDesc.trim(),
        code: cheatCode.trim(),
        profileId: 1,
      });
      setCheatDesc("");
      setCheatCode("");
      await refetchCheats();
    } finally {
      setAddingCheat(false);
    }
  };

  const fetchCheatsFromDb = async () => {
    if (!activeGame?.romId) return;
    setFetchingCheats(true);
    setFetchedCheats(null);
    setFetchMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/roms/${activeGame.romId}/fetch-cheats`));
      const data = await res.json() as { cheats: { desc: string; code: string }[]; message?: string };
      if (data.cheats.length === 0) setFetchMsg(data.message ?? "No database entries.");
      else setFetchedCheats(data.cheats.map((c) => ({ ...c, selected: false })));
    } catch {
      setFetchMsg("Link offline.");
    } finally {
      setFetchingCheats(false);
    }
  };

  const importSelectedCheats = async () => {
    if (!activeGame?.romId || !fetchedCheats) return;
    const selected = fetchedCheats.filter((c) => c.selected);
    for (const c of selected) {
      await apiRequest("POST", `/api/roms/${activeGame.romId}/cheats`, {
        description: c.desc,
        code: c.code,
        profileId: 1,
      });
    }
    await refetchCheats();
    setFetchedCheats(null);
  };

  const toggleCheat = async (id: number, enabled: boolean) => {
    await apiRequest("PATCH", `/api/cheats/${id}`, { enabled });
    await refetchCheats();
  };

  const deleteCheat = async (id: number) => {
    await apiRequest("DELETE", `/api/cheats/${id}`);
    await refetchCheats();
  };

  const deleteSlot = async (slot: number) => {
    if (!activeGame?.romId) return;
    await apiRequest("DELETE", `/api/roms/${activeGame.romId}/save-states/${slot}`);
    await refetchSlots();
  };

  // ── Info Panel Sections ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"info" | "cheats" | "saves" | "meta">("info");

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[50] bg-[#0c0c0c] text-white flex flex-col select-none overflow-hidden font-sans">

      {/* Dynamic Background Fanart (High Blur) */}
      <AnimatePresence mode="wait">
        {activeGame && (
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            {activeGame.artUrl ? (
              <img
                src={activeGame.artUrl}
                className="w-full h-full object-cover opacity-30 blur-[15px] scale-110"
                alt=""
              />
            ) : (
              <div
                className="w-full h-full opacity-20"
                style={{ background: `radial-gradient(circle at center, hsl(${activeGame.art[0]}), #000 80%)` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-[#0c0c0c]/90" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar */}
      <div className="h-16 px-8 hidden xl:flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl z-20">
        <div className="flex items-center gap-6">
          <div className="text-primary font-black tracking-tighter text-xl italic uppercase">HomeArcade</div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-4">
             <Link href="/history">
               <Button variant="ghost" size="sm" className="text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all">Activity</Button>
             </Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Search */}
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <Input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games... (press /)"
              className="pl-9 pr-8 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm font-mono"
              aria-label="Search games"
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); searchRef.current?.blur(); } }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {/* Sort */}
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1">
            <SlidersHorizontal className="size-3.5 text-white/30 ml-1.5 mr-0.5" />
            {(["recent", "title", "year", "rating", "plays"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setSort(o)}
                className={`px-2 py-1 rounded font-mono text-[11px] uppercase tracking-wider ${
                  sort === o ? "bg-primary text-white" : "text-white/30 hover:text-white"
                }`}
              >
                {o === "recent" ? "Recent" : o === "az" ? "A-Z" : o.charAt(0).toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
          <Link href="/settings"><SettingsIcon className="size-4 cursor-pointer hover:text-white transition-colors text-white/30" /></Link>
          <div className="font-mono text-sm font-black tracking-[0.2em] text-white/80 tabular-nums">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative z-10">

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && !searchQuery && (
          <div className="shrink-0 border-b border-white/5 px-8 py-4">
            <div className="font-display text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-3">Recently Played</div>
            <div className="flex gap-4 overflow-x-auto scrollbar-none pb-1">
              {recentlyPlayed.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => {
                    const idx = filteredGames.findIndex((g) => g.id === game.id);
                    if (idx >= 0) setActiveGameIdx(idx);
                    if (window.innerWidth < 1280) setShowMobileDetails(true);
                  }}
                  className="shrink-0 w-28 aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900/50 group flex flex-col items-center"
                >
                  <div className="relative w-full h-full flex-1">
                    {game.artUrl ? (
                      <img src={game.artUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full" style={{ background: `linear-gradient(135deg, hsl(${game.art[0]}), hsl(${game.art[1]}))` }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="w-full bg-white/5 px-1.5 py-1 text-center">
                    <div className="text-[9px] font-bold truncate text-white/80 leading-tight">{game.title}</div>
                    <div className="text-[8px] text-white/30 uppercase">{game.system.toUpperCase()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Browse Systems */}
        <div className="shrink-0 border-b border-white/5 px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Browse Systems</div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
            {SYSTEMS.filter((s) => s.count > 0).map((system) => {
              const count = allGames.filter((g) => g.system === system.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => setSearchQuery("filter:" + system.id)}
                  className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group hover:border-white/30 transition-all"
                  style={{ background: `linear-gradient(140deg, hsl(${system.art[0]}) 0%, hsl(${system.art[1]}) 100%)` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <div className="text-2xl font-black text-white">{system.mono}</div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-1.5 left-2 right-2">
                    <div className="text-[9px] font-black uppercase truncate text-white">{system.shortName}</div>
                    <div className="text-[8px] text-white/50 font-mono">{count} titles</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* All Games Grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-y-auto p-8 scrollbar-none overscroll-y-contain pb-24 lg:pb-8"
        >
          {filteredGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/30">
              <Search className="size-8 mb-3" />
              <div className="font-display text-sm font-black uppercase tracking-widest">No games found</div>
              {searchQuery && <div className="text-xs mt-1">Try a different search</div>}
            </div>
          ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                {filteredGames.map((game, i) => {
                  const isActive = i === activeGameIdx;
                  return (
                    <motion.div
                      key={game.id}
                      animate={{ scale: isActive ? 1.08 : 1 }}
                      whileHover={{ scale: 1.05 }}
                      className={`relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 ${
                        isActive
                          ? "ring-4 ring-primary shadow-[0_0_40px_rgba(var(--primary),0.3)] z-10"
                          : "ring-1 ring-white/10 opacity-70 hover:opacity-100"
                      }`}
                      onClick={() => {
                        setActiveGameIdx(i);
                        if (window.innerWidth < 1280) setShowMobileDetails(true);
                      }}
                    >
                      <div className="absolute inset-0 bg-neutral-900/50 flex items-center justify-center">
                        {game.artUrl ? (
                          <img src={game.artUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-[10px] font-black uppercase text-white/20 px-4 text-center">{game.title}</span>
                        )}
                      </div>

                      {isActive && (
                        <motion.div
                          animate={{ opacity: [0.2, 0.5, 0.2] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 ring-4 ring-primary rounded-2xl pointer-events-none"
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  );
                })}
             </div>
          )}

          {/* Right Info Panel (The Glass Hub) */}
          <AnimatePresence>
             {(activeGame && (window.innerWidth >= 1280 || showMobileDetails)) && (
               <motion.div
                 initial={{ x: "100%", opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: "100%", opacity: 0 }}
                 transition={{ type: "spring", damping: 28, stiffness: 180 }}
                 className={`fixed right-0 top-0 sm:top-16 bottom-0 w-full sm:w-[450px] 2xl:w-[500px] border-l border-white/10 bg-black/80 backdrop-blur-3xl z-[60] flex flex-col p-6 sm:p-12 ${!showMobileDetails && "hidden xl:flex"}`}
               >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileDetails(false)}
                    className="absolute top-6 left-6 xl:hidden text-white/50 hover:text-white z-[70]"
                  >
                    <ChevronLeft className="size-6 rotate-180" />
                  </Button>

                  {/* Header Area */}
                  <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 mb-6 shrink-0 relative shadow-2xl group">
                     {activeGame.artUrl ? (
                       <img src={activeGame.artUrl} className="w-full h-full object-cover opacity-80" alt="" />
                     ) : (
                       <div className="w-full h-full bg-neutral-900" />
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                     <div className="absolute bottom-6 left-8 right-8">
                        <div className="font-display text-2xl font-black uppercase tracking-tight text-white drop-shadow-2xl leading-none">{activeGame.title}</div>
                     </div>
                  </div>

                  {/* Internal Navigation Tabs - Optimized for Mobile */}
                  <div className="flex gap-2 mb-6 shrink-0 overflow-x-auto scrollbar-none no-scrollbar pb-2">
                     {[
                       { id: "info", label: "Overview", icon: Info },
                       { id: "cheats", label: "Cheats", icon: Zap },
                       { id: "saves", label: "Saves", icon: Save },
                       { id: "meta", label: "Manage", icon: Database },
                     ].map(tab => (
                       <button
                         key={tab.id}
                         onClick={() => setActiveTab(tab.id as any)}
                         className={`flex-1 min-w-[85px] flex flex-col items-center py-3 rounded-xl border transition-all ${
                           activeTab === tab.id
                             ? "bg-white/15 border-white/30 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                             : "bg-white/[0.04] border-white/5 text-white/40 hover:text-white/60"
                         }`}
                       >
                          <tab.icon className="size-4 mb-1" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
                       </button>
                     ))}
                  </div>

                  {/* Dynamic Content Body */}
                  <div className="flex-1 overflow-y-auto scrollbar-none no-scrollbar pr-2 -mr-2 pb-24 sm:pb-0">
                     <AnimatePresence mode="wait">
                        {activeTab === "info" && (
                          <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                             <div className="flex flex-wrap gap-3">
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/50">{activeGame.year || '----'}</div>
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-primary font-black italic">{SYSTEMS.find(s => s.id === activeGame.system)?.name ?? activeGame.system}</div>
                                {activeGame.rating > 0 && (
                                   <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 text-yellow-500 font-black font-mono text-[10px] tracking-widest">
                                      <Star className="size-3 fill-current" /> {activeGame.rating}/5
                                   </div>
                                )}
                             </div>
                             <div className="space-y-3">
                                <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-white/20">Game Description</div>
                                <p className="text-base text-white/60 leading-relaxed font-medium">{activeGame.description || "No description available for this title."}</p>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/20">Play Time</div>
                                   <div className="font-mono text-2xl font-black text-white/90 tabular-nums">{fmtHoursShort(activeGame.minutesPlayed ?? 0)}</div>
                                </div>
                                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-1 relative group cursor-pointer" onClick={() => setActiveTab("saves")}>
                                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/20">Latest Save</div>
                                   <div className="font-mono text-xs font-black uppercase tracking-[0.2em] text-primary">
                                     {latestSave ? `${latestSave.label}` : 'None'}
                                   </div>
                                   {latestSave && (
                                     <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                                       <Save className="size-4 text-primary" />
                                     </div>
                                   )}
                                </div>
                             </div>

                             {raProgress && raProgress.NumAchievements > 0 && (
                                <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
                                   <div className="flex items-center justify-between">
                                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold flex items-center gap-2">
                                         <Trophy className="size-3" /> RetroAchievements
                                      </div>
                                      <div className="text-[10px] font-mono font-black text-white/80">{raProgress.NumAwarded} / {raProgress.NumAchievements}</div>
                                   </div>
                                   <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                      <div className="h-full bg-primary" style={{ width: `${(raProgress.NumAwarded / raProgress.NumAchievements) * 100}%` }} />
                                   </div>
                                </div>
                             )}
                          </motion.div>
                        )}

                        {activeTab === "cheats" && (
                          <motion.div key="cheats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                             <div className="flex items-center justify-between">
                                <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-white/20">Cheat Codes</div>
                                <button onClick={fetchCheatsFromDb} disabled={fetchingCheats} className="text-primary hover:text-white transition-colors disabled:opacity-40" title="Fetch from Libretro">
                                   {fetchingCheats ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                                </button>
                             </div>

                             {fetchedCheats && (
                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                                   <div className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">Cloud Codes Found</div>
                                   <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-none">
                                      {fetchedCheats.map((c, i) => (
                                         <button
                                           key={i}
                                           onClick={() => setFetchedCheats(p => p?.map((x, j) => j === i ? { ...x, selected: !x.selected } : x) ?? null)}
                                           className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${c.selected ? "bg-primary/20 border-primary/40" : "bg-white/5 border-transparent opacity-60 hover:opacity-100"}`}
                                         >
                                            <div className={`size-4 rounded-full border-2 flex items-center justify-center ${c.selected ? "bg-primary border-primary" : "border-white/10"}`}>
                                               {c.selected && <Check className="size-2.5 text-black" />}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase truncate">{c.desc}</span>
                                         </button>
                                      ))}
                                   </div>
                                   <Button onClick={importSelectedCheats} className="w-full h-12 rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest">Import Selected</Button>
                                </div>
                             )}

                             <div className="space-y-3">
                                {cheats.map(c => (
                                   <CheatRow key={c.id} cheat={c} onToggle={() => toggleCheat(c.id, !c.enabled)} onDelete={() => deleteCheat(c.id)} />
                                ))}
                                {cheats.length === 0 && !fetchingCheats && !fetchedCheats && (
                                   <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                      <Zap className="size-8 mx-auto mb-3" />
                                      <span className="text-[10px] font-mono uppercase tracking-widest">No cheats added</span>
                                   </div>
                                )}
                             </div>
                          </motion.div>
                        )}

                        {activeTab === "saves" && (
                          <motion.div key="saves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                             <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-white/20">Save States</div>
                             <div className="grid grid-cols-3 gap-3">
                                {saveSlots.map(s => (
                                   <SaveSlotCard key={s.slot} slot={s} romId={activeGame.romId!} onDelete={() => deleteSlot(s.slot)} />
                                ))}
                                {saveSlots.length === 0 && (
                                   <div className="col-span-3 py-12 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                      <Save className="size-8 mx-auto mb-3" />
                                      <span className="text-[10px] font-mono uppercase tracking-widest">No save states</span>
                                   </div>
                                )}
                             </div>
                          </motion.div>
                        )}

                        {activeTab === "meta" && (
                          <motion.div key="meta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                             <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-white/20">Management</div>

                             <div className="space-y-4">
                                <Button onClick={refreshArt} disabled={scrapingArt} variant="outline" className="w-full h-14 rounded-2xl border-white/5 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white uppercase tracking-widest text-[10px] font-black gap-3">
                                   {scrapingArt ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                                   Refresh Cover Art
                                </Button>

                                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-4">
                                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/20">Game Collections</div>
                                   <div className="flex flex-wrap gap-2">
                                      {collections.map(c => {
                                         const isMember = c.romIds.includes(activeGame.romId!);
                                         return (
                                           <button
                                             key={c.id}
                                             onClick={() => handleToggleCollection(c.id, activeGame, !isMember)}
                                             className={`px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${isMember ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-transparent text-white/30"}`}
                                           >
                                              {c.name}
                                           </button>
                                         );
                                      })}
                                      <button onClick={handleCreateCollection} className="px-4 py-2 rounded-full border border-dashed border-white/20 text-white/20 hover:text-white hover:border-white/40 transition-all">
                                         <Plus className="size-3" />
                                      </button>
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* Actions (Pinned to bottom) */}
                  <div className="pt-8 pb-12 sm:pb-0 flex flex-col gap-4 shrink-0">
                     {latestSave && (
                       <Button
                         variant="outline"
                         size="lg"
                         onClick={() => {
                           const returnTo = encodeURIComponent(window.location.href);
                           window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}&loadSlot=${latestSave.slot}`);
                         }}
                         className="w-full h-14 rounded-2xl border-white/10 bg-white/5 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-3"
                       >
                         <History className="size-4 text-primary" /> Resume {latestSave.label}
                       </Button>
                     )}
                     <div className="flex gap-3">
                        <Button
                          size="lg"
                          onClick={() => {
                            const returnTo = encodeURIComponent(window.location.href);
                            window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                          }}
                          className="flex-[2] h-16 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-[0.3em] text-sm shadow-[0_20px_50px_rgba(255,255,255,0.1)] transition-transform active:scale-95"
                        >
                          <Play className="size-5 mr-3 fill-current" /> Play
                        </Button>
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setShowWarpDialog(true)}
                          className="flex-1 h-16 rounded-2xl border-white/10 bg-white/5 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                        >
                           <QrCode className="size-4 text-primary" />
                           <span className="text-[9px]">Warp</span>
                        </Button>
                     </div>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>


      <WelcomeDialog hasRoms={roms.length > 0} />
      <WarpLinkDialog
        game={showWarpDialog ? activeGame : null}
        slot={latestSave?.slot}
        onClose={() => setShowWarpDialog(false)}
      />

      {showScanner && (
        <WarpScanner
          onClose={() => setShowScanner(false)}
          onScan={(url) => {
            setShowScanner(false);
            // Internal redirect to the scanned warp link
            window.location.href = url;
          }}
        />
      )}
    </div>
  );
}
