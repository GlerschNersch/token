import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game } from "@/data/library";
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
  Star,
  Info
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

export default function NostalgiaTheme() {
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

  const recentlyPlayed = useMemo(
    () =>
      [...games]
        .filter((g) => g.lastPlayed && g.lastPlayed > 0)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 15),
    [games],
  );

  const [focus, setFocus] = useState({ shelf: recentlyPlayed.length > 0 ? -1 : 0, game: 0 });

  const activeGame = useMemo(() => {
    if (focus.shelf === -1) return recentlyPlayed[focus.game];
    const shelf = systemsWithGames[focus.shelf];
    return shelf?.games[focus.game];
  }, [focus, recentlyPlayed, systemsWithGames]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeGame || selectedGame) return;
      
      setFocus(prev => {
        let { shelf, game } = prev;
        const currentShelfGames = shelf === -1 ? recentlyPlayed : systemsWithGames[shelf].games;

        if (e.key === "ArrowRight") {
          game = Math.min(game + 1, currentShelfGames.length - 1);
        } else if (e.key === "ArrowLeft") {
          game = Math.max(game - 1, 0);
        } else if (e.key === "ArrowDown") {
          if (shelf < systemsWithGames.length - 1) {
            shelf++;
            const nextShelfGames = systemsWithGames[shelf].games;
            game = Math.min(game, nextShelfGames.length - 1);
          }
        } else if (e.key === "ArrowUp") {
          if (shelf > -1) {
            if (shelf === 0 && recentlyPlayed.length > 0) {
              shelf = -1;
              game = Math.min(game, recentlyPlayed.length - 1);
            } else if (shelf > 0) {
              shelf--;
              const nextShelfGames = systemsWithGames[shelf].games;
              game = Math.min(game, nextShelfGames.length - 1);
            }
          }
        } else if (e.key === "Enter") {
          openGame(activeGame);
          return prev;
        } else {
          return prev;
        }

        return { shelf, game };
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGame, recentlyPlayed, systemsWithGames, selectedGame]);

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
                className="w-full h-full object-cover opacity-40 blur-[10px] scale-105" 
                alt="" 
              />
            ) : (
              <div 
                className="w-full h-full opacity-30"
                style={{ background: `radial-gradient(circle at 70% 30%, hsl(${activeGame.art[0]}), transparent 80%)` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full h-full flex flex-col md:flex-row max-w-[1800px] mx-auto">
        <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 sm:p-10 pb-32 scrollbar-none space-y-12">
          {recentlyPlayed.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-xl font-bold text-white/90 uppercase tracking-tight">Jump Back In</h2>
                <span className="font-mono text-[9px] text-white/30 tracking-[0.3em]">Recently Played</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none no-scrollbar">
                {recentlyPlayed.map((game, i) => {
                  const isActive = focus.shelf === -1 && i === focus.game;
                  return (
                    <motion.div
                      key={game.id}
                      onMouseEnter={() => setFocus({ shelf: -1, game: i })}
                      onClick={() => openGame(game)}
                      animate={{ scale: isActive ? 1.05 : 1 }}
                      className={`relative w-40 shrink-0 aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                        isActive ? "ring-4 ring-white shadow-[0_0_30px_rgba(255,255,255,0.4)]" : "ring-1 ring-white/10"
                      }`}
                    >
                      {game.artUrl ? <img src={game.artUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted" />}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-50" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {systemsWithGames.map((group, sIdx) => (
            <div key={group.system.id} className="space-y-4">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-xl font-bold text-white/90 uppercase tracking-tight">{group.system.name}</h2>
                <span className="font-mono text-[9px] text-white/30 tracking-[0.3em]">{group.games.length} Titles</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none no-scrollbar">
                {group.games.map((game, i) => {
                  const isActive = focus.shelf === sIdx && i === focus.game;
                  return (
                    <motion.div
                      key={game.id}
                      onMouseEnter={() => setFocus({ shelf: sIdx, game: i })}
                      onClick={() => openGame(game)}
                      animate={{ scale: isActive ? 1.05 : 1 }}
                      className={`relative w-40 shrink-0 aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                        isActive ? "ring-4 ring-white shadow-[0_0_30px_rgba(255,255,255,0.4)]" : "ring-1 ring-white/10"
                      }`}
                    >
                      {game.artUrl ? <img src={game.artUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted" />}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-50" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {!roms.length && (
            <div className="flex flex-col items-center justify-center h-[50vh] opacity-50">
               <Info className="size-12 mb-4" />
               <p className="font-mono uppercase tracking-widest text-sm">Library Empty</p>
            </div>
          )}
        </div>

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
                <div className="absolute bottom-6 left-6 right-6">
                   <div className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold mb-1">
                     {SYSTEMS.find(s => s.id === activeGame.system)?.name ?? activeGame.system}
                   </div>
                   <h2 className="font-display text-2xl lg:text-3xl font-bold leading-tight text-white drop-shadow-md line-clamp-2">
                     {activeGame.title}
                   </h2>
                </div>
              </div>

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
