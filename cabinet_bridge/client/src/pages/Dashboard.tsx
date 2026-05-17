import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game } from "@/data/library";
import { GameCard } from "@/components/GameCard";
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
  Clock, 
  Trophy, 
  Star,
  ChevronRight,
  Info
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

// ─── main page: Nostalgia Grid ───────────────────────────────────────────────
export default function Dashboard() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
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

  // Display top 20 recent/favorite games in the grid
  const gridGames = useMemo(() => {
    return [...games]
      .filter((g) => (g.lastPlayed && g.lastPlayed > 0) || g.favorite)
      .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
      .slice(0, 20);
  }, [games]);

  // If no recent games, fallback to just a list of all games to show something
  const displayGames = gridGames.length > 0 ? gridGames : games.slice(0, 20);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeGame = displayGames[activeIndex];

  // Keyboard navigation for the grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeGame || selectedGame) return; // Disable if dialog open
      const cols = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;
      
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, displayGames.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + cols, displayGames.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - cols, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        openGame(activeGame);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGame, displayGames.length, selectedGame]);

  const launchGame = (game: Game) => {
    if (game.romId) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
    } else {
      openGame(game);
    }
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-black text-white relative select-none">
      <MobileTopBar />

      {/* Dynamic Background Fanart */}
      <AnimatePresence mode="wait">
        {activeGame && (
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            {activeGame.artUrl ? (
              <img 
                src={activeGame.artUrl} 
                className="w-full h-full object-cover opacity-40 blur-[8px] scale-105" 
                alt="" 
              />
            ) : (
              <div 
                className="w-full h-full opacity-30"
                style={{ background: `radial-gradient(circle at 70% 30%, hsl(${activeGame.art[0]}), transparent 80%)` }}
              />
            )}
            {/* Gradient overlay to ensure text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full h-full flex flex-col md:flex-row max-w-[1800px] mx-auto">
        
        {/* Left Side: Game Grid */}
        <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 sm:p-10 pb-32 scrollbar-none">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white/90">
              {displayGames.length > 0 && gridGames.length > 0 ? "Jump Back In" : "Your Library"}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50 mt-2">
              Nostalgia Grid
            </p>
          </div>

          {displayGames.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {displayGames.map((game, i) => {
                const isActive = i === activeIndex;
                return (
                  <motion.div
                    key={game.id}
                    className="relative cursor-pointer"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => openGame(game)}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      zIndex: isActive ? 10 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div 
                      className={`relative aspect-[2/3] rounded-xl overflow-hidden transition-all duration-300 ${
                        isActive ? "ring-4 ring-white shadow-[0_0_30px_rgba(255,255,255,0.4)]" : "ring-1 ring-white/10 shadow-lg"
                      }`}
                    >
                      {game.artUrl ? (
                        <img src={game.artUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div 
                          className="w-full h-full"
                          style={{ background: `linear-gradient(135deg, hsl(${game.art[0]}), hsl(${game.art[1]}))` }}
                        />
                      )}
                      
                      {/* Inner sheen */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-50" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] opacity-50">
               <Info className="size-12 mb-4" />
               <p className="font-mono uppercase tracking-widest text-sm">Library Empty</p>
            </div>
          )}
        </div>

        {/* Right Side: Frosted Glass Info Panel */}
        <AnimatePresence mode="wait">
          {activeGame && (
            <motion.div 
              key={activeGame.id + "panel"}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden md:flex w-[350px] lg:w-[450px] shrink-0 h-full border-l border-white/10 bg-black/40 backdrop-blur-2xl flex-col"
            >
              {/* Top half: Hero image or Logo space */}
              <div className="relative w-full aspect-video border-b border-white/10 bg-black/20 overflow-hidden shrink-0">
                {activeGame.artUrl ? (
                  <img src={activeGame.artUrl} className="w-full h-full object-cover opacity-60" alt="" />
                ) : (
                  <div 
                    className="w-full h-full opacity-30"
                    style={{ background: `linear-gradient(135deg, hsl(${activeGame.art[0]}), hsl(${activeGame.art[1]}))` }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                
                {/* Logo / Title overlay */}
                <div className="absolute bottom-6 left-6 right-6">
                   <div className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold mb-1">
                     {SYSTEMS.find(s => s.id === activeGame.system)?.name ?? activeGame.system}
                   </div>
                   <h2 className="font-display text-2xl lg:text-3xl font-bold leading-tight text-white drop-shadow-md line-clamp-2">
                     {activeGame.title}
                   </h2>
                </div>
              </div>

              {/* Bottom half: Metadata & Actions */}
              <div className="p-6 lg:p-8 flex flex-col flex-1 overflow-y-auto scrollbar-none">
                <div className="flex items-center gap-4 mb-6">
                  {activeGame.year > 0 && (
                    <span className="px-3 py-1 rounded bg-white/10 font-mono text-[11px] font-bold text-white/80">
                      {activeGame.year}
                    </span>
                  )}
                  {activeGame.rating > 0 && (
                    <div className="flex items-center gap-1 text-yellow-500">
                       <Star className="size-4 fill-current" />
                       <span className="font-mono text-xs font-bold pt-0.5">{activeGame.rating}/5</span>
                    </div>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                    {activeGame.genre}
                  </span>
                </div>

                <div className="text-sm text-white/70 leading-relaxed line-clamp-6 mb-8 font-medium">
                  {activeGame.description || "No description available."}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                     <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1">Time Played</div>
                     <div className="font-mono font-bold text-lg">{fmtHoursShort(activeGame.minutesPlayed ?? 0)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                     <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1">Last Played</div>
                     <div className="font-mono font-bold text-sm leading-tight pt-1">
                       {activeGame.lastPlayed ? formatRelative(activeGame.lastPlayed) : "Never"}
                     </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 flex flex-col gap-3">
                  <Button 
                    size="lg" 
                    onClick={() => launchGame(activeGame)}
                    className="w-full h-14 rounded-xl bg-white hover:bg-white/90 text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    <Play className="size-5 mr-2" /> Play Now
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => openGame(activeGame)}
                    className="w-full h-14 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
