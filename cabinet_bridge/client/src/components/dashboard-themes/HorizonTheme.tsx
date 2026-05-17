import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game, type System } from "@/data/library";
import { GameCard } from "@/components/GameCard";
import { SystemTile } from "@/components/GameArt";
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
  History, 
  ChevronRight,
  Info
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Link, useLocation } from "wouter";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

function SectionHeader({
  title,
  href,
  count,
}: {
  title: string;
  href?: string;
  count?: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-3">
        {count !== undefined && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("dashboard.stats.gamesCount", { count })}
          </span>
        )}
        {href && (
          <Link
            href={href}
            className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
          >
            {t("common.ui.seeAll")} →
          </Link>
        )}
      </div>
    </div>
  );
}

function HorizontalShelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-6 -mx-1 px-1 scrollbar-none overscroll-x-contain">
      {children}
    </div>
  );
}

function ConsoleCarousel({ 
  systems, 
  roms,
  onSelect 
}: { 
  systems: System[]; 
  roms: UploadedRom[];
  onSelect: (s: System) => void;
}) {
  const [index, setIndex] = useState(0);
  const { t } = useTranslation();
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-200, 200], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-15, 15]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleNext = () => setIndex((i) => (i + 1) % systems.length);
  const handlePrev = () => setIndex((i) => (i - 1 + systems.length) % systems.length);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Enter") onSelect(systems[index]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, systems]);

  const activeSystem = systems[index];
  const activeCount = roms.filter(r => r.system === activeSystem.id).length;

  return (
    <div className="relative w-full min-h-[500px] sm:min-h-[600px] flex flex-col justify-center overflow-hidden touch-none select-none">
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSystem.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none"
        >
          <div 
            className="absolute inset-0 opacity-40 transition-colors duration-1000"
            style={{
              background: `radial-gradient(circle at 50% 40%, hsl(${activeSystem.art[0]}), transparent 80%)`,
            }}
          />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] grayscale contrast-150 mix-blend-overlay scale-150">
             <SystemTile system={activeSystem} className="w-full h-full" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 w-full">
        <div className="flex items-center justify-center gap-4 px-8 overflow-visible">
          <motion.div 
            className="flex items-center gap-4 sm:gap-6 px-[40vw] sm:px-[45vw]"
            animate={{ x: index * -(window.innerWidth < 640 ? 196 : 256) }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
            drag="x"
            dragConstraints={{ left: (systems.length - 1) * -256, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -40) handleNext();
              else if (info.offset.x > 40) handlePrev();
            }}
          >
            {systems.map((system, i) => {
              const isActive = i === index;
              return (
                <motion.div
                  key={system.id}
                  animate={{
                    scale: isActive ? 1.1 : 0.85,
                    opacity: isActive ? 1 : 0.5,
                    y: isActive ? -10 : 0
                  }}
                  whileHover={{ scale: isActive ? 1.12 : 0.9 }}
                  className={`relative w-[180px] sm:w-[240px] aspect-square shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isActive ? "ring-4 ring-white shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "border border-white/5 bg-white/5 backdrop-blur-sm"
                  }`}
                  onClick={() => isActive ? onSelect(system) : setIndex(i)}
                >
                  <SystemTile system={system} />
                  <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isActive ? "opacity-0" : "opacity-100"}`} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <motion.div 
        key={activeSystem.id + "-hud"}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center text-center mt-12 gap-1 px-8"
      >
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.4em] text-white/50 mb-1">
          System Select
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter text-foreground leading-none">
          {activeSystem.name}
        </h1>
        <div className="flex items-center gap-4 mt-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
           <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{activeSystem.era}</span>
           <span className="w-1 h-1 rounded-full bg-primary/40" />
           <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest font-bold text-primary">{activeCount} Titles</span>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(activeSystem)}
          className="mt-8 px-10 h-14 rounded-xl bg-white text-black font-black uppercase tracking-widest text-sm shadow-[0_15px_30px_rgba(255,255,255,0.1)] hover:bg-white/90 transition-colors flex items-center gap-2"
        >
          {t("common.ui.play")} <ChevronRight className="size-4" />
        </motion.button>
      </motion.div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1.5 px-12 z-10">
        <div className="flex gap-1.5 overflow-x-auto max-w-full pb-2 scrollbar-none px-4 no-scrollbar">
           {systems.map((_, i) => (
             <div 
               key={i} 
               className={`h-1 transition-all duration-500 rounded-full ${
                 i === index ? "w-8 bg-white" : "w-1.5 bg-white/20"
               }`}
             />
           ))}
        </div>
      </div>
    </div>
  );
}

export default function HorizonTheme() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: sessions = [] } = useQuery<Array<{ id: number; romId: number; romTitle: string; romSystem: string; startedAt: number; endedAt: number | null; durationSeconds: number | null }>>({
    queryKey: ["/api/sessions"],
    staleTime: 30_000,
  });
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

  const recentlyPlayed = useMemo(
    () =>
      [...games]
        .filter((g) => g.lastPlayed && g.lastPlayed > 0)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 8),
    [games],
  );

  const handleSystemSelect = (s: System) => {
    setLocation(`/library/${s.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0 overscroll-y-contain bg-background/20">
      <MobileTopBar />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto space-y-12"
      >
        <motion.section variants={itemVariants} className="pt-8">
           <ConsoleCarousel 
             systems={SYSTEMS} 
             roms={roms} 
             onSelect={handleSystemSelect} 
           />
        </motion.section>

        <div className="px-5 sm:px-8 space-y-12 pb-12">
          {recentlyPlayed.length > 0 && (
            <motion.section variants={itemVariants} className="space-y-4">
              <SectionHeader
                title={t("dashboard.sections.recentlyPlayed")}
                href="/library/recent"
                count={recentlyPlayed.length}
              />
              <HorizontalShelf>
                {recentlyPlayed.map((g, i) => (
                  <div key={g.id} className="w-44 shrink-0">
                    <GameCard game={g} onOpen={openGame} onToggleFav={handleToggleFav} priority={i < 4} />
                  </div>
                ))}
              </HorizontalShelf>
            </motion.section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
             <motion.div variants={itemVariants} className="md:col-span-8 bg-card/30 backdrop-blur-md border border-border rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {t("dashboard.sections.recentActivity")}
                  </div>
                  <Link href="/history" className="text-[10px] font-mono uppercase text-primary hover:underline">
                    {t("common.ui.seeAll")} →
                  </Link>
                </div>
                <div className="divide-y divide-border/40">
                  {sessions.slice(0, 5).map((s) => {
                    const system = SYSTEMS.find((sys) => sys.id === s.romSystem);
                    const dur = s.durationSeconds
                      ? s.durationSeconds < 60
                        ? `${s.durationSeconds}s`
                        : `${Math.round(s.durationSeconds / 60)}m`
                      : null;
                    const when = formatRelative(s.startedAt);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-4 py-3 group cursor-pointer"
                        onClick={() => {
                          const g = games.find(game => game.romId === s.romId);
                          if (g) openGame(g);
                        }}
                      >
                        <div className="size-8 rounded bg-secondary/30 flex items-center justify-center shrink-0 group-hover:bg-secondary/50 transition-colors">
                          <History className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{s.romTitle}</div>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/60">
                            {config.showSystemLabels && (
                              <span className="uppercase tracking-wider">{system?.shortName ?? s.romSystem}</span>
                            )}
                            {dur && <span>· {dur}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 font-mono text-[10px] text-muted-foreground/40">{when}</div>
                      </div>
                    );
                  })}
                </div>
             </motion.div>

             <motion.div variants={itemVariants} className="md:col-span-4 bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col justify-center text-center gap-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  Library Health
                </div>
                <div className="space-y-1">
                   <div className="text-4xl font-display font-black text-foreground">{games.length}</div>
                   <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Total ROMs Verified</div>
                </div>
                <Link href="/settings">
                   <Button variant="outline" size="sm" className="w-full mt-4 font-mono text-[10px] uppercase tracking-wider gap-2">
                     <Info className="size-3.5" /> Check System Status
                   </Button>
                </Link>
             </motion.div>
          </div>
        </div>
      </motion.div>

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
