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
  Gamepad2,
  ChevronRight,
  Star,
  Info
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

export default function GameOSTheme() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const {
    selectedGame,
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

  // Navigation Logic (PS5 style - Top bar for systems, Grid for games)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedGame) return;

      if (e.key === "ArrowRight") {
        setActiveGameIdx(i => Math.min(i + 1, (currentSystem?.games.length || 1) - 1));
      } else if (e.key === "ArrowLeft") {
        setActiveGameIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "ArrowDown") {
        // In GameOS, we usually scroll systems with L1/R1, but we'll use Up/Down here
        setActiveSystemIdx(i => (i + 1) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "ArrowUp") {
        setActiveSystemIdx(i => (i - 1 + systemsWithGames.length) % systemsWithGames.length);
        setActiveGameIdx(0);
      } else if (e.key === "Enter" && activeGame) {
        openGame(activeGame);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSystemIdx, activeGameIdx, systemsWithGames, selectedGame, currentSystem, activeGame]);

  return (
    <div className="flex-1 h-full overflow-hidden bg-black text-white flex flex-col relative select-none">
      <MobileTopBar />

      {/* Full-Screen Fanart Background (Deep Contrast) */}
      <AnimatePresence mode="wait">
        {activeGame && (
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            {activeGame.artUrl ? (
              <img 
                src={activeGame.artUrl} 
                className="w-full h-full object-cover opacity-60 grayscale-[0.3] contrast-[1.2]" 
                alt="" 
              />
            ) : (
              <div 
                className="w-full h-full opacity-40"
                style={{ background: `linear-gradient(to bottom right, hsl(${activeGame.art[0]}), #000)` }}
              />
            )}
            {/* Immersive Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/20" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI Overlay */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10 p-12 lg:p-20">
        
        {/* Top Platform Bar (Minimalist) */}
        <div className="flex gap-10 mb-12 items-center">
           <div className="flex items-center gap-3">
              <Gamepad2 className="size-6 text-primary" />
              <span className="font-display text-2xl font-black tracking-tighter uppercase italic">GameOS</span>
           </div>
           <div className="h-6 w-px bg-white/20" />
           <div className="flex gap-8 overflow-x-auto scrollbar-none no-scrollbar">
              {systemsWithGames.map((group, i) => (
                <button
                  key={group.system.id}
                  onClick={() => { setActiveSystemIdx(i); setActiveGameIdx(0); }}
                  className={`text-sm font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap pb-2 border-b-2 ${
                    i === activeSystemIdx 
                      ? "border-primary text-white" 
                      : "border-transparent text-white/30 hover:text-white/60"
                  }`}
                >
                  {group.system.shortName}
                </button>
              ))}
           </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col min-h-0 justify-end">
           
           {/* Active Game Meta HUD (Left-aligned) */}
           <AnimatePresence mode="wait">
             {activeGame && (
               <motion.div
                 key={activeGame.id + "-hud"}
                 initial={{ opacity: 0, x: -50 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -50 }}
                 className="max-w-2xl mb-12 space-y-6"
               >
                  <div className="flex items-center gap-4">
                     <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                        {currentSystem.system.name}
                     </div>
                     {activeGame.year > 0 && (
                       <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">{activeGame.year}</div>
                     )}
                     {activeGame.rating > 0 && (
                       <div className="flex items-center gap-1 text-yellow-500 text-[10px] font-bold">
                          <Star className="size-3 fill-current" /> {activeGame.rating}/5
                       </div>
                     )}
                  </div>
                  <h1 className="font-display text-5xl lg:text-7xl font-black uppercase tracking-tighter text-white leading-none drop-shadow-2xl">
                    {activeGame.title}
                  </h1>
                  <p className="text-lg text-white/60 font-medium line-clamp-3 leading-relaxed max-w-xl">
                    {activeGame.description || "The definitive experience is waiting. Initialize sequence to begin playback."}
                  </p>
                  <div className="flex gap-4 pt-4">
                     <Button 
                       size="lg"
                       onClick={() => {
                         const returnTo = encodeURIComponent(window.location.href);
                         window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                       }}
                       className="h-16 px-12 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:bg-white/90 shadow-2xl transition-transform active:scale-95"
                     >
                       Play Game
                     </Button>
                     <Button 
                       size="lg"
                       variant="outline"
                       onClick={() => openGame(activeGame)}
                       className="h-16 px-8 rounded-2xl border-white/20 bg-black/40 backdrop-blur-md text-white font-bold uppercase tracking-widest hover:bg-white/10"
                     >
                       Details
                     </Button>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* Hero Grid (Bottom) */}
           <div className="relative">
              <div className="flex gap-6 overflow-x-auto pb-10 pt-4 scrollbar-none no-scrollbar px-2 -mx-2">
                 {currentSystem?.games.map((game, i) => {
                   const isActive = i === activeGameIdx;
                   return (
                     <motion.div
                       key={game.id}
                       animate={{ 
                         scale: isActive ? 1.15 : 1,
                         y: isActive ? -10 : 0
                       }}
                       className={`relative w-44 lg:w-56 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer shadow-2xl transition-all ${
                         isActive ? "ring-4 ring-white" : "opacity-60 hover:opacity-100 ring-1 ring-white/10"
                       }`}
                       onMouseEnter={() => setActiveGameIdx(i)}
                       onClick={() => openGame(game)}
                     >
                        {game.artUrl ? <img src={game.artUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-neutral-900" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-40" />
                     </motion.div>
                   );
                 })}
              </div>
           </div>
        </div>
      </div>

      <GameDetailDialog
        game={selectedGame}
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
