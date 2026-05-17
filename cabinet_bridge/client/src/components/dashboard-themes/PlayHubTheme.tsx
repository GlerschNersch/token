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

  // Navigation Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedGame) return;

      if (e.key === "ArrowRight") {
        setActiveGameIdx(i => Math.min(i + 1, (currentSystem?.games.length || 1) - 1));
      } else if (e.key === "ArrowLeft") {
        setActiveGameIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "ArrowDown") {
        // In PlayHub, Down moves into the grid if we were in the system selector, 
        // but here we'll use it to wrap rows if we implement a real grid.
        // For now, let's keep it simple: Down moves to next system.
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

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#0a0a0b] text-white flex flex-col relative select-none">
      <MobileTopBar />

      {/* Top Bar */}
      <div className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-md z-20">
        <div className="flex items-center gap-6">
          <div className="text-primary font-black tracking-tighter text-xl italic uppercase">PlayHub</div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-4">
             <Link href="/library/all">
               <Button variant="ghost" size="sm" className="text-xs uppercase tracking-widest text-white/60 hover:text-white">Library</Button>
             </Link>
             <Link href="/history">
               <Button variant="ghost" size="sm" className="text-xs uppercase tracking-widest text-white/60 hover:text-white">Activity</Button>
             </Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-4 text-white/40">
              <Search className="size-4 cursor-pointer hover:text-white transition-colors" />
              <Link href="/settings"><SettingsIcon className="size-4 cursor-pointer hover:text-white transition-colors" /></Link>
           </div>
           <div className="font-mono text-sm font-bold tracking-widest text-white/80">
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
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 80% 20%, hsl(${activeGame.art[0]}), transparent 70%), 
                           radial-gradient(circle at 20% 80%, hsl(${activeGame.art[1]}), transparent 70%)`
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        
        {/* System Selector (Vertical List) */}
        <div className="flex gap-4 p-8 overflow-x-auto scrollbar-none no-scrollbar h-24 shrink-0 items-center border-b border-white/5">
           {systemsWithGames.map((group, i) => (
             <button
               key={group.system.id}
               onClick={() => { setActiveSystemIdx(i); setActiveGameIdx(0); }}
               className={`px-6 py-2 rounded-full font-display text-xs font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                 i === activeSystemIdx 
                   ? "bg-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.4)]" 
                   : "bg-white/5 text-white/40 hover:bg-white/10"
               }`}
             >
               {group.system.name}
             </button>
           ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0">
          
          {/* Game Grid */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-none space-y-12">
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {currentSystem?.games.map((game, i) => {
                  const isActive = i === activeGameIdx;
                  return (
                    <motion.div
                      key={game.id}
                      animate={{ scale: isActive ? 1.08 : 1 }}
                      className={`relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer group ${
                        isActive ? "ring-4 ring-primary shadow-2xl" : "ring-1 ring-white/10"
                      }`}
                      onMouseEnter={() => setActiveGameIdx(i)}
                      onClick={() => openGame(game)}
                    >
                      {game.artUrl ? <img src={game.artUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-neutral-900" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="text-[10px] font-bold uppercase truncate">{game.title}</div>
                      </div>
                    </motion.div>
                  );
                })}
             </div>
          </div>

          {/* Side Info Panel (Glassmorphism) */}
          <AnimatePresence mode="wait">
             {activeGame && (
               <motion.div
                 key={activeGame.id}
                 initial={{ x: 300, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: 300, opacity: 0 }}
                 className="w-96 border-l border-white/5 bg-white/[0.02] backdrop-blur-3xl flex flex-col p-8 hidden 2xl:flex"
               >
                  <div className="aspect-video rounded-xl overflow-hidden border border-white/10 mb-8 shrink-0 relative">
                     {activeGame.artUrl ? <img src={activeGame.artUrl} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full bg-neutral-900" />}
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] to-transparent" />
                     <div className="absolute bottom-4 left-4 font-display text-lg font-black uppercase tracking-tight text-white">{activeGame.title}</div>
                  </div>

                  <div className="flex gap-3 mb-8">
                     <div className="px-3 py-1 rounded bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/60">{activeGame.year || '----'}</div>
                     <div className="px-3 py-1 rounded bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-widest text-primary/80 font-bold">{currentSystem.system.shortName}</div>
                  </div>

                  <div className="space-y-6 flex-1 overflow-y-auto scrollbar-none">
                     <div className="space-y-2">
                        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">Description</div>
                        <p className="text-sm text-white/60 leading-relaxed font-medium line-clamp-6">{activeGame.description || "No transmission data available for this sector."}</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                           <div className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">Playtime</div>
                           <div className="font-mono text-lg font-bold">{fmtHoursShort(activeGame.minutesPlayed ?? 0)}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                           <div className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">Rating</div>
                           <div className="flex items-center gap-1 text-yellow-500 font-bold text-lg">
                              <Star className="size-4 fill-current" /> {activeGame.rating || '-'}/5
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-8">
                     <Button 
                       onClick={() => {
                         const returnTo = encodeURIComponent(window.location.href);
                         window.location.href = apiUrl(`/api/roms/${activeGame.romId}/player?return=${returnTo}`);
                       }}
                       className="w-full h-14 rounded-2xl bg-white hover:bg-white/90 text-black font-black uppercase tracking-widest shadow-2xl"
                     >
                       <Play className="size-5 mr-3 fill-current" /> Initialize
                     </Button>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-12 px-8 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center gap-8 z-20">
         <div className="flex items-center gap-2">
            <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">A</div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Select</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">B</div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Back</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="size-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold">X</div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Favorite</span>
         </div>
         <div className="flex-1" />
         <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">HomeArcade OS 2.9</div>
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
