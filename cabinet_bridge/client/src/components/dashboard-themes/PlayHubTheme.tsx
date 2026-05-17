import React, { useMemo, useState, useEffect } from "react";
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
  Search,
  Settings as SettingsIcon,
  Clock,
  Star,
  Info,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

export default function PlayHubTheme() {
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
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  
  const currentSystem = systemsWithGames[activeSystemIdx];
  const activeGame = currentSystem?.games[activeGameIdx];

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
        if (window.innerWidth < 1280) {
          setShowMobileDetails(true);
        } else {
          openGame(activeGame);
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
    <div className="fixed inset-0 lg:left-0 z-[50] bg-[#0a0a0b] text-white flex flex-col select-none overflow-hidden">
      
      {/* Top Bar - Refined */}
      <div className="h-16 px-4 sm:px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-primary font-black tracking-tighter text-xl italic uppercase hidden sm:block">PlayHub</div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex gap-2 sm:gap-4">
             <Link href="/library/all">
               <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs uppercase tracking-widest text-white/60 hover:text-white">Library</Button>
             </Link>
             <Link href="/history">
               <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs uppercase tracking-widest text-white/60 hover:text-white">Activity</Button>
             </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
           <div className="flex items-center gap-4 text-white/40">
              <Search className="size-4 cursor-pointer hover:text-white transition-colors" />
              <Link href="/settings"><SettingsIcon className="size-4 cursor-pointer hover:text-white transition-colors" /></Link>
           </div>
           <div className="font-mono text-xs sm:text-sm font-bold tracking-widest text-white/80 tabular-nums">
             {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </div>
        </div>
      </div>

      {/* Background Ambience */}
      <AnimatePresence mode="wait">
        {activeGame && (
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 80% 20%, hsl(${activeGame.art[0]}), transparent 75%), 
                           radial-gradient(circle at 20% 80%, hsl(${activeGame.art[1]}), transparent 75%)`
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        
        {/* System Selector */}
        <div className="flex gap-3 p-4 sm:p-8 overflow-x-auto scrollbar-none no-scrollbar h-20 sm:h-24 shrink-0 items-center border-b border-white/5 bg-black/10">
           {systemsWithGames.map((group, i) => (
             <button
               key={group.system.id}
               onClick={() => { setActiveSystemIdx(i); setActiveGameIdx(0); }}
               className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-full font-display text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                 i === activeSystemIdx 
                   ? "bg-primary text-white shadow-[0_0_25px_rgba(var(--primary),0.5)] scale-105" 
                   : "bg-white/5 text-white/40 hover:bg-white/10"
               }`}
             >
               {group.system.name}
             </button>
           ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0">
          
          {/* Game Grid - Responsive */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-none">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-6">
                {currentSystem?.games.map((game, i) => {
                  const isActive = i === activeGameIdx;
                  return (
                    <motion.div
                      key={game.id}
                      animate={{ 
                        scale: isActive ? 1.08 : 1,
                        opacity: 1
                      }}
                      whileHover={{ scale: 1.05 }}
                      className={`relative aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 ${
                        isActive 
                          ? "ring-4 ring-primary shadow-[0_0_30px_rgba(var(--primary),0.4)] z-10 active-selection" 
                          : "ring-1 ring-white/10 opacity-70 hover:opacity-100"
                      }`}
                      onMouseEnter={() => {
                        if (window.innerWidth >= 1024) setActiveGameIdx(i);
                      }}
                      onClick={() => {
                        setActiveGameIdx(i);
                        if (window.innerWidth < 1280) {
                          setShowMobileDetails(true);
                        } else {
                          openGame(game);
                        }
                      }}
                    >
                      {game.artUrl ? (
                        <img src={game.artUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-neutral-900 flex items-center justify-center p-4 text-center">
                          <span className="text-[10px] font-bold uppercase text-white/20">{game.title}</span>
                        </div>
                      )}
                      
                      {/* Pulse effect for active item */}
                      {isActive && (
                        <motion.div 
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 ring-4 ring-primary rounded-xl sm:rounded-2xl pointer-events-none" 
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  );
                })}
             </div>
          </div>

          {/* Info Panel - Desktop & Mobile Overlay */}
          <AnimatePresence>
             {(activeGame && (window.innerWidth >= 1280 || showMobileDetails)) && (
               <motion.div
                 initial={{ x: "100%", opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: "100%", opacity: 0 }}
                 transition={{ type: "spring", damping: 30, stiffness: 200 }}
                 className={`fixed right-0 top-16 bottom-12 w-full sm:w-[400px] xl:w-[450px] 2xl:w-[500px] border-l border-white/10 bg-black/60 backdrop-blur-3xl z-30 flex flex-col p-6 sm:p-10 ${!showMobileDetails && "hidden 1280:flex"}`}
               >
                  {/* Close button for mobile */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowMobileDetails(false)}
                    className="absolute top-4 right-4 sm:hidden text-white/40"
                  >
                    <ChevronLeft className="size-6 rotate-180" />
                  </Button>

                  <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 mb-8 shrink-0 relative shadow-2xl">
                     {activeGame.artUrl ? (
                       <img src={activeGame.artUrl} className="w-full h-full object-cover opacity-80" />
                     ) : (
                       <div className="w-full h-full bg-neutral-900" />
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                     <div className="absolute bottom-6 left-6 right-6">
                        <div className="font-display text-2xl font-black uppercase tracking-tight text-white drop-shadow-2xl">{activeGame.title}</div>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-8">
                     <div className="px-4 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-[11px] uppercase tracking-widest text-white/60">{activeGame.year || '----'}</div>
                     <div className="px-4 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-[11px] uppercase tracking-widest text-primary font-bold">{currentSystem.system.name}</div>
                     {activeGame.rating > 0 && (
                        <div className="px-4 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-yellow-500 font-bold font-mono text-[11px]">
                           <Star className="size-3 fill-current" /> {activeGame.rating}/5
                        </div>
                     )}
                  </div>

                  <div className="space-y-8 flex-1 overflow-y-auto scrollbar-none">
                     <div className="space-y-3">
                        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Description</div>
                        <p className="text-sm sm:text-base text-white/70 leading-relaxed font-medium">{activeGame.description || "No mission brief available for this title."}</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                           <div className="text-[10px] font-mono uppercase tracking-widest text-white/30">Time Logged</div>
                           <div className="font-mono text-xl font-bold">{fmtHoursShort(activeGame.minutesPlayed ?? 0)}</div>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                           <div className="text-[10px] font-mono uppercase tracking-widest text-white/30">Status</div>
                           <div className="font-mono text-xs font-bold uppercase tracking-wider text-primary">{activeGame.playStatus || 'Unplayed'}</div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-8 flex flex-col gap-3">
                     <Button 
                       onClick={() => {
                         const returnTo = encodeURIComponent(window.location.href);
                         window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                       }}
                       className="w-full h-16 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-transform active:scale-95"
                     >
                       <Play className="size-5 mr-3 fill-current" /> Initialize Game
                     </Button>
                     <Button 
                       variant="outline"
                       onClick={() => openGame(activeGame)}
                       className="w-full h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest sm:hidden"
                     >
                       Edit Metadata
                     </Button>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Bar - Mobile Friendly */}
      <div className="h-12 px-4 sm:px-8 border-t border-white/5 bg-black/60 backdrop-blur-xl flex items-center justify-between z-20">
         <div className="flex items-center gap-4 sm:gap-8">
           <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">A</div>
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-white/40">Select</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">B</div>
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-white/40">Back</span>
           </div>
           <div className="hidden sm:flex items-center gap-2">
              <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">X</div>
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-white/40">Favorite</span>
           </div>
         </div>
         <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/10 hidden sm:block">HomeArcade v2.9.1</div>
         <div className="sm:hidden text-[9px] font-mono uppercase tracking-widest text-white/20">PlayHub Mobile</div>
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
      
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes active-pulse {
          0% { box-shadow: 0 0 0 0 rgba(var(--primary), 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(var(--primary), 0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--primary), 0); }
        }
        .active-selection {
          animation: active-pulse 2s infinite;
        }
      `}} />
    </div>
  );
}
