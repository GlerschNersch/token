import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game, type System } from "@/data/library";
import { GameDetailDialog } from "@/components/GameDetailDialog";
import { MobileTopBar } from "@/components/MobileNav";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { Button } from "@/components/ui/button";
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
  LayoutGrid
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

  const games = useMemo(() => roms.map(uploadedRomToGame), [roms]);

  // Group games by system
  const systemsWithGames = useMemo(() => {
    const groups: Record<string, Game[]> = {};
    for (const g of games) {
      if (!groups[g.system]) groups[g.system] = [];
      groups[g.system].push(g);
    }
    
    return SYSTEMS.map(s => ({
      system: s,
      games: groups[s.id] || []
    })).filter(group => group.games.length > 0);
  }, [games]);

  const [activeSystemIdx, setActiveSystemIdx] = useState(0);
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  
  const currentSystem = systemsWithGames[activeSystemIdx];
  const activeGame = currentSystem?.games[activeGameIdx];

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

  // Navigation Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dialogGame) return;

      if (e.key === "ArrowRight") {
        setActiveGameIdx(i => Math.min(i + 1, (currentSystem?.games.length || 1) - 1));
      } else if (e.key === "ArrowLeft") {
        setActiveGameIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "ArrowDown") {
        setActiveSystemIdx(i => (i + 1) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "ArrowUp") {
        setActiveSystemIdx(i => (i - 1 + systemsWithGames.length) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "Enter" && activeGame) {
        if (window.innerWidth < 1280) setShowMobileDetails(true);
        else {
          const returnTo = encodeURIComponent(window.location.href);
          window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSystemIdx, activeGameIdx, systemsWithGames, dialogGame, currentSystem, activeGame]);

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
             <Link href="/library/all">
               <Button variant="ghost" size="sm" className="text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all">Library</Button>
             </Link>
             <Link href="/history">
               <Button variant="ghost" size="sm" className="text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all">Activity</Button>
             </Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-5 text-white/30">
              <Search className="size-4 cursor-pointer hover:text-white transition-colors" />
              <Link href="/settings"><SettingsIcon className="size-4 cursor-pointer hover:text-white transition-colors" /></Link>
           </div>
           <div className="font-mono text-sm font-black tracking-[0.2em] text-white/80 tabular-nums">
             {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        
        {/* System Selector (Horizontal Tabs) */}
        <div className="relative h-24 shrink-0 border-b border-white/5 bg-black/10">
           <div className="flex gap-3 p-8 overflow-x-auto scrollbar-none no-scrollbar items-center h-full pr-28">
              {systemsWithGames.map((group, i) => (
                <button
                  key={group.system.id}
                  onClick={() => { setActiveSystemIdx(i); setActiveGameIdx(0); }}
                  className={`px-6 py-2 rounded-full font-display text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap ${
                    i === activeSystemIdx 
                      ? "bg-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.4)] scale-105" 
                      : "bg-white/5 text-white/30 hover:bg-white/10"
                  }`}
                >
                  {group.system.name}
                </button>
              ))}
           </div>

           {/* Mobile Quick Actions (Pinned to right) */}
           <div className="xl:hidden absolute right-0 top-0 bottom-0 flex items-center px-4 bg-gradient-to-l from-[#0c0c0c] via-[#0c0c0c]/80 to-transparent z-20">
              <div className="h-8 w-px bg-white/10 mr-2" />
              <div className="flex items-center gap-0.5">
                <Link href="/library/all">
                  <Button variant="ghost" size="icon" className="text-white/70 hover:text-white">
                    <LayoutGrid className="size-5" />
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="text-white/70 hover:text-white">
                    <SettingsIcon className="size-5" />
                  </Button>
                </Link>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Game Grid */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-none overscroll-y-contain">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                {currentSystem?.games.map((game, i) => {
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
                      onMouseEnter={() => { if (window.innerWidth >= 1024) setActiveGameIdx(i); }}
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
                      
                      {/* Pulse ring for active item */}
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
          </div>

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
                  <div className="flex-1 overflow-y-auto scrollbar-none no-scrollbar pr-2 -mr-2 pb-12 sm:pb-0">
                     <AnimatePresence mode="wait">
                        {activeTab === "info" && (
                          <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                             <div className="flex flex-wrap gap-3">
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/50">{activeGame.year || '----'}</div>
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-primary font-black italic">{currentSystem.system.name}</div>
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
                                <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/20">Status</div>
                                   <div className="font-mono text-xs font-black uppercase tracking-[0.2em] text-primary">{activeGame.playStatus || 'Unplayed'}</div>
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
                     <Button 
                       size="lg"
                       onClick={() => {
                         const returnTo = encodeURIComponent(window.location.href);
                         window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                       }}
                       className="w-full h-16 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-[0.3em] text-sm shadow-[0_20px_50px_rgba(255,255,255,0.1)] transition-transform active:scale-95"
                     >
                       <Play className="size-5 mr-3 fill-current" /> Play Game
                     </Button>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>


      <WelcomeDialog hasRoms={roms.length > 0} />
    </div>
  );
}
