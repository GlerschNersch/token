import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game, type System } from "@/data/library";
import { GameDetailDialog } from "@/components/GameDetailDialog";
import { MobileTopBar } from "@/components/MobileNav";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/queryClient";
import { formatRelative, useIntegration } from "@/lib/integration";
import { useGameDialogState } from "@/lib/useGameDialogState";
import type { UploadedRom, GameCollectionWithItems } from "@shared/schema";
import { 
  Play, 
  Star,
  Monitor,
  Calendar,
  User,
  Gamepad2,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

export default function SlateTheme() {
  const { config } = useIntegration();
  const { t } = useTranslation();
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
  
  const currentSystem = systemsWithGames[activeSystemIdx];
  const activeGame = currentSystem?.games[activeGameIdx];

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll list to keep active item centered
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${activeGameIdx}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeGameIdx]);

  // Navigation Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dialogGame) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveGameIdx(i => Math.min(i + 1, (currentSystem?.games.length || 1) - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveGameIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveSystemIdx(i => (i + 1) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveSystemIdx(i => (i - 1 + systemsWithGames.length) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "Enter" && activeGame) {
        e.preventDefault();
        openGame(activeGame);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSystemIdx, activeGameIdx, systemsWithGames, dialogGame, currentSystem, activeGame]);

  return (
    <div className="fixed inset-0 lg:left-0 z-[50] bg-[#1a1a1a] text-[#eeeeee] flex flex-col select-none overflow-hidden font-sans">
      <MobileTopBar />

      {/* System Selection Header */}
      <div className="h-16 px-6 flex items-center border-b border-white/5 bg-[#2c2c2c] z-20 shadow-md">
        <div className="flex gap-1 overflow-x-auto scrollbar-none no-scrollbar h-full items-center">
           {systemsWithGames.map((group, i) => (
             <button
               key={group.system.id}
               onClick={() => { setActiveSystemIdx(i); setActiveGameIdx(0); }}
               className={`h-full px-5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all whitespace-nowrap border-b-2 ${
                 i === activeSystemIdx 
                   ? "border-primary text-white bg-white/5" 
                   : "border-transparent text-white/40 hover:text-white/60 hover:bg-white/5"
               }`}
             >
               {group.system.name}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        
        {/* Left Side: Game List (ES-DE style) */}
        <div 
          ref={listRef}
          className="w-full md:w-[300px] lg:w-[400px] h-full overflow-y-auto scrollbar-none bg-[#242424] border-r border-white/5"
        >
           <div className="py-4">
              {currentSystem?.games.map((game, i) => {
                const isActive = i === activeGameIdx;
                return (
                  <div
                    key={game.id}
                    data-index={i}
                    onClick={() => setActiveGameIdx(i)}
                    onDoubleClick={() => openGame(game)}
                    className={`px-6 py-3 cursor-pointer transition-all border-l-4 ${
                      isActive 
                        ? "bg-primary/20 border-primary text-white font-bold" 
                        : "border-transparent text-white/40 hover:bg-white/5 hover:text-white/70"
                    }`}
                  >
                    <div className="text-sm truncate uppercase tracking-wide">{game.title}</div>
                  </div>
                );
              })}
           </div>
        </div>

        {/* Right Side: Metadata Panel (Slate aesthetic) */}
        <div className="flex-1 h-full overflow-y-auto scrollbar-none flex flex-col md:flex-row p-6 lg:p-12 gap-8 lg:gap-12 bg-gradient-to-br from-[#1a1a1a] to-[#242424]">
          
          <AnimatePresence mode="wait">
             {activeGame && (
               <motion.div
                 key={activeGame.id}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.2 }}
                 className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full"
               >
                  {/* Art Section */}
                  <div className="w-full lg:w-[450px] shrink-0 space-y-6">
                     <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/10 shadow-2xl bg-black/40">
                        {activeGame.artUrl ? (
                          <img src={activeGame.artUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10">
                             <Gamepad2 className="size-20" />
                          </div>
                        )}
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-md bg-[#2c2c2c] border border-white/5 flex items-center gap-3">
                           <Calendar className="size-4 text-primary" />
                           <div>
                              <div className="text-[9px] uppercase tracking-widest text-white/40">Released</div>
                              <div className="text-xs font-bold">{activeGame.year || 'Unknown'}</div>
                           </div>
                        </div>
                        <div className="p-4 rounded-md bg-[#2c2c2c] border border-white/5 flex items-center gap-3">
                           <User className="size-4 text-primary" />
                           <div>
                              <div className="text-[9px] uppercase tracking-widest text-white/40">Players</div>
                              <div className="text-xs font-bold">Single Player</div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Info Section */}
                  <div className="flex-1 flex flex-col min-w-0">
                     <div className="space-y-2 mb-8">
                        <div className="text-xs font-mono uppercase tracking-[0.3em] text-primary font-bold">
                           {currentSystem.system.name}
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight leading-none text-white">
                           {activeGame.title}
                        </h1>
                        <div className="flex items-center gap-4 pt-2">
                           <div className="flex items-center gap-1 text-yellow-500">
                              <Star className="size-4 fill-current" />
                              <span className="font-mono text-sm font-bold">{activeGame.rating || '-'}/5</span>
                           </div>
                           <div className="h-3 w-px bg-white/10" />
                           <div className="text-xs font-medium text-white/60">{activeGame.genre}</div>
                        </div>
                     </div>

                     <div className="bg-[#2c2c2c]/50 rounded-lg border border-white/5 p-6 lg:p-8 flex-1 mb-8 overflow-y-auto scrollbar-none">
                        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">Synopsis</div>
                        <p className="text-base text-white/70 leading-relaxed font-medium">
                           {activeGame.description || "No description provided for this software title. Accessing archive database..."}
                        </p>
                     </div>

                     <div className="flex gap-4">
                        <Button 
                          onClick={() => {
                            const returnTo = encodeURIComponent(window.location.href);
                            window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                          }}
                          className="h-14 px-10 rounded-md bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm shadow-xl"
                        >
                          Launch Software
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => openGame(activeGame)}
                          className="h-14 px-8 rounded-md border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-xs"
                        >
                          View Details
                        </Button>
                     </div>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>

          {!activeGame && (
             <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                <Monitor className="size-24 mb-6" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Select Software</h2>
             </div>
          )}
        </div>
      </div>

      {/* Footer / Shortcut Hints */}
      <div className="h-12 px-6 border-t border-white/5 bg-[#2c2c2c] flex items-center justify-between z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
         <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-white/10 font-mono text-[9px] font-bold">UP/DN</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40">Browse</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-white/10 font-mono text-[9px] font-bold">LT/RT</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40">System</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-white/10 font-mono text-[9px] font-bold">ENT</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40">Launch</span>
           </div>
         </div>
         <div className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/10">Slate Edition 2.10</div>
      </div>

      <GameDetailDialog
        game={dialogGame}
        onClose={closeGame}
        onToggleFav={handleToggleFav}
        onRate={handleRate}
        collections={collections}
        onCreateCollection={handleCreateCollection}
        onToggleCollection={handleToggleCollection}
        onSetStatus={handleSetStatus}
      />
      <WelcomeDialog hasRoms={roms.length > 0} />
    </div>
  );
}
