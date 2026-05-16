import React, { useMemo, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
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
  Trophy, 
  ListTodo, 
  TrendingUp, 
  Star, 
  Zap, 
  History, 
  Radio, 
  Gamepad2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

// ─── animation variants ───────────────────────────────────────────────────────
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

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

// ─── sub-components ───────────────────────────────────────────────────────────
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
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-none">{children}</div>
  );
}

// ─── Console Carousel ─────────────────────────────────────────────────────────

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

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
    <div className="relative w-full py-12 flex flex-col items-center gap-8 overflow-hidden min-h-[500px]">
      {/* Background Glow */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSystem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, hsl(${activeSystem.art[0]}), transparent 70%)`,
          }}
        />
      </AnimatePresence>

      <div className="flex items-center gap-4 sm:gap-12 relative z-10 w-full justify-center px-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handlePrev}
          className="size-12 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/20 transition-all shrink-0 hidden sm:flex"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <div className="flex items-center justify-center gap-6 sm:gap-10 perspective-[1000px]">
          {/* We show 3 consoles: Prev, Current, Next */}
          {[-1, 0, 1].map((offset) => {
            const idx = (index + offset + systems.length) % systems.length;
            const system = systems[idx];
            const isActive = offset === 0;
            const isPrev = offset === -1;
            const isNext = offset === 1;

            return (
              <motion.div
                key={system.id}
                animate={{
                  scale: isActive ? 1.1 : 0.8,
                  opacity: isActive ? 1 : 0.4,
                  rotateY: isActive ? 0 : offset * 25,
                  x: isActive ? 0 : offset * 40,
                  z: isActive ? 50 : 0
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`relative w-[240px] sm:w-[320px] aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer shadow-2xl ${
                  isActive ? "ring-4 ring-primary shadow-primary/20" : ""
                }`}
                onClick={() => isActive ? onSelect(system) : setIndex(idx)}
              >
                <SystemTile system={system} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                   <div className="font-display text-xl font-bold text-white drop-shadow-md">
                     {system.shortName}
                   </div>
                   <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                     {system.era}
                   </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleNext}
          className="size-12 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/20 transition-all shrink-0 hidden sm:flex"
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>

      {/* Info HUD */}
      <motion.div 
        key={activeSystem.id + "-info"}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2 z-10"
      >
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-neon">
          {activeSystem.name}
        </h1>
        <div className="flex items-center justify-center gap-4 text-muted-foreground font-mono text-xs uppercase tracking-widest">
          <span>{activeSystem.era} Era</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-primary font-bold">{activeCount} Games Loaded</span>
        </div>
        <div className="pt-4">
          <Button 
            size="lg" 
            onClick={() => onSelect(activeSystem)}
            className="rounded-full px-8 gap-2 bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            Explore Library <ChevronRight className="size-4" />
          </Button>
        </div>
      </motion.div>

      {/* Breadcrumb Indicator */}
      <div className="flex gap-1.5 z-10 pt-4">
        {systems.map((_, i) => (
          <div 
            key={i} 
            className={`h-1 rounded-full transition-all duration-300 ${
              i === index ? "w-8 bg-primary" : "w-2 bg-border/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
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

  // ── recently played ──
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
        {/* Main Hero: Console Carousel */}
        <motion.section variants={itemVariants} className="pt-8">
           <ConsoleCarousel 
             systems={SYSTEMS} 
             roms={roms} 
             onSelect={handleSystemSelect} 
           />
        </motion.section>

        <div className="px-5 sm:px-8 space-y-12 pb-12">
          {/* Quick Access Shelves */}
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

          {/* Activity Feed & Stats Grid */}
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
