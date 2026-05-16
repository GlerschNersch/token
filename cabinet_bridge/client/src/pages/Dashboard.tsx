import React, { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { uploadedRomToGame, SYSTEMS, type Game } from "@/data/library";
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
import { Play, Clock, Trophy, ListTodo, TrendingUp, Star, Zap, History, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtHours(minutes: number, playedLabel: string) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  let time = "";
  if (h === 0) time = `${m}m`;
  else if (m === 0) time = `${h}h`;
  else time = `${h}h ${m}m`;
  return `${time} ${playedLabel}`;
}

function fmtHoursShort(minutes: number) {
  const h = minutes / 60;
  if (h < 1) return `${minutes}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

// ─── sub-components ───────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 h-full">
      <div
        className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
          accent ?? "text-muted-foreground"
        }`}
      >
        {icon}
        {label}
      </div>
      <div className="font-display text-3xl font-bold text-foreground leading-none">{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

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
    <div className="flex items-center justify-between mb-3">
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

function HighlightCard({
  label,
  game,
  stat,
  statLabel,
  icon,
  onOpen,
  showSystem = true,
}: {
  label: string;
  game: Game;
  stat: string;
  statLabel: string;
  icon: React.ReactNode;
  onOpen: (g: Game) => void;
  showSystem?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      className="flex-1 min-w-[180px] rounded-xl border border-border bg-card p-4 flex flex-col gap-3 text-left hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group"
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      {game.artUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/50">
           <img src={game.artUrl} alt={game.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        </div>
      ) : (
        <div
          className="w-full aspect-video rounded-lg"
          style={{
            background: `linear-gradient(135deg, hsl(${game.art[0]}) 0%, hsl(${game.art[1]}) 100%)`,
          }}
        />
      )}
      <div>
        <div className="font-medium text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
          {game.title}
        </div>
        {showSystem && (
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {game.system}
          </div>
        )}
      </div>
      <div className="mt-auto pt-1 border-t border-border/40 flex items-baseline gap-1.5">
        <span className="font-display text-lg font-bold text-primary">{stat}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {statLabel}
        </span>
      </div>
    </button>
  );
}

function SystemBar({
  system,
  minutes,
  maxMinutes,
}: {
  system: (typeof SYSTEMS)[number];
  minutes: number;
  maxMinutes: number;
}) {
  const pct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
  const [a, b] = system.art;
  return (
    <div className="flex items-center gap-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-12 shrink-0 text-right">
        {system.shortName}
      </div>
      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, hsl(${a}), hsl(${b}))`,
          }}
        />
      </div>
      <div className="font-mono text-[10px] text-muted-foreground w-10 shrink-0 tabular-nums">
        {fmtHoursShort(minutes)}
      </div>
    </div>
  );
}

function StatusDonut({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const { t } = useTranslation();
  const items = [
    { key: "playing", label: t("dashboard.status.playing"), color: "#3b82f6" },
    { key: "completed", label: t("dashboard.status.completed"), color: "#00c87a" },
    { key: "backlog", label: t("dashboard.status.backlog"), color: "#f59e0b" },
    { key: "dropped", label: t("dashboard.status.dropped"), color: "#ef4444" },
    { key: "unset", label: t("dashboard.status.untracked"), color: "#334155" },
  ];
  const unset = total - Object.values(counts).reduce((s, v) => s + v, 0);
  const all: Record<string, number> = { ...counts, unset };

  const r = 40;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = items.map((item) => {
    const count = all[item.key] ?? 0;
    const pct = total > 0 ? count / total : 0;
    const dash = pct * circumference;
    const seg = { ...item, count, pct, dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-6 py-2">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="12"
          className="opacity-20"
        />
        {segments.map((s) =>
          s.pct > 0 ? (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ) : null,
        )}
      </svg>
      <div className="flex flex-col gap-2">
        {segments
          .filter((s) => s.key !== "unset" || s.count > 0)
          .map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="font-mono text-[10px] text-muted-foreground w-20 truncate">{s.label}</span>
              <span className="font-mono text-[11px] font-semibold text-foreground tabular-nums">{s.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function ActivityBar({
  thisWeek,
  lastWeek,
}: {
  thisWeek: number;
  lastWeek: number;
}) {
  const { t } = useTranslation();
  const max = Math.max(thisWeek, lastWeek, 1);
  const diff = thisWeek - lastWeek;
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 h-20">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 bg-border rounded-sm overflow-hidden" style={{ height: 60 }}>
            <div
              className="w-full bg-muted-foreground/30 rounded-sm transition-all duration-500"
              style={{
                height: `${(lastWeek / max) * 100}%`,
                marginTop: `${100 - (lastWeek / max) * 100}%`,
              }}
            />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {t("dashboard.activity.lastWeek")}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground tabular-nums">{lastWeek}</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 bg-border rounded-sm overflow-hidden" style={{ height: 60 }}>
            <div
              className="w-full bg-primary rounded-sm transition-all duration-500"
              style={{
                height: `${(thisWeek / max) * 100}%`,
                marginTop: `${100 - (thisWeek / max) * 100}%`,
              }}
            />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-primary font-bold">
            {t("dashboard.activity.thisWeek")}
          </div>
          <div className="font-mono text-[11px] font-bold text-foreground tabular-nums">{thisWeek}</div>
        </div>
        <div className="ml-4 flex-1 pb-4">
          {diff > 0 ? (
            <div className="font-mono text-[11px] text-status-online">
              {t("dashboard.activity.more", { count: diff })}
            </div>
          ) : diff < 0 ? (
            <div className="font-mono text-[11px] text-destructive">
              {t("dashboard.activity.fewer", { count: Math.abs(diff) })}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-muted-foreground">{t("dashboard.activity.same")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: sessions = [] } = useQuery<Array<{ id: number; romId: number; romTitle: string; romSystem: string; startedAt: number; endedAt: number | null; durationSeconds: number | null }>>({
    queryKey: ["/api/sessions"],
    staleTime: 30_000,
  });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const { data: nowPlaying } = useQuery<{ playing: boolean; id?: number; title?: string; system?: string }>({   
    queryKey: ["/api/now-playing"],
    queryFn: async () => { 
      const res = await fetch(apiUrl("/api/now-playing")); 
      if (!res.ok) return { playing: false };
      return res.json(); 
    },
    refetchInterval: (query) => {
      if (document.hidden) return false;
      return query.state.data?.playing ? 5000 : 15000;
    },
    staleTime: 5000,
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

  const nowPlayingGame = nowPlaying?.playing && nowPlaying.id
    ? games.find((g) => g.romId === nowPlaying.id) ?? null
    : null;

  // ── metrics ──
  const totalMinutes = useMemo(
    () => games.reduce((s, g) => s + (g.minutesPlayed ?? 0), 0),
    [games],
  );
  const completed = useMemo(
    () => games.filter((g) => g.playStatus === "completed").length,
    [games],
  );
  const backlog = useMemo(() => games.filter((g) => g.playStatus === "backlog").length, [games]);
  const completionRate =
    games.length > 0 ? Math.round((completed / games.length) * 100) : 0;

  // ── status counts ──
  const statusCounts = useMemo(
    () => ({
      playing: games.filter((g) => g.playStatus === "playing").length,
      completed,
      backlog,
      dropped: games.filter((g) => g.playStatus === "dropped").length,
    }),
    [games, completed, backlog],
  );

  // ── system breakdown ──
  const systemBreakdown = useMemo(
    () =>
      SYSTEMS.map((s) => ({
        system: s,
        minutes: games
          .filter((g) => g.system === s.id)
          .reduce((sum, g) => sum + (g.minutesPlayed ?? 0), 0),
      }))
        .filter((s) => s.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 6),
    [games],
  );
  const maxSystemMinutes = systemBreakdown[0]?.minutes ?? 0;

  // ── highlights ──
  const mostPlayed = useMemo(
    () =>
      [...games]
        .filter((g) => (g.minutesPlayed ?? 0) > 0)
        .sort((a, b) => (b.minutesPlayed ?? 0) - (a.minutesPlayed ?? 0))[0],
    [games],
  );
  const highestRated = useMemo(
    () =>
      [...games].filter((g) => g.rating > 0).sort((a, b) => b.rating - a.rating)[0],
    [games],
  );
  const bestCommunity = useMemo(
    () =>
      [...games]
        .filter((g) => g.communityScore != null)
        .sort((a, b) => (b.communityScore ?? 0) - (a.communityScore ?? 0))[0],
    [games],
  );

  // ── activity ──
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = useMemo(
    () => games.filter((g) => g.lastPlayed && g.lastPlayed > now - WEEK).length,
    [games],
  );
  const lastWeekCount = useMemo(
    () =>
      games.filter(
        (g) => g.lastPlayed && g.lastPlayed > now - 2 * WEEK && g.lastPlayed <= now - WEEK,
      ).length,
    [games],
  );

  // ── shelves ──
  const continueGame = useMemo(
    () =>
      [...games]
        .filter((g) => g.lastPlayed && g.lastPlayed > 0)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0],
    [games],
  );
  const inProgress = useMemo(() => games.filter((g) => g.playStatus === "playing"), [games]);
  const recentlyPlayed = useMemo(
    () =>
      [...games]
        .filter((g) => g.lastPlayed && g.lastPlayed > 0)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 8),
    [games],
  );
  const newAdditions = useMemo(
    () =>
      [...games]
        .filter((g) => g.createdAt && g.createdAt > now - WEEK)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [games],
  );

  const showHighlights = mostPlayed || highestRated || bestCommunity;
  const showSystemChart = systemBreakdown.length > 0;

  const launchGame = (game: Game) => {
    if (game.romId) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
    } else {
      openGame(game);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0 overscroll-y-contain">
      {/* Mobile top bar */}
      <MobileTopBar />

      {/* ── Now Playing live banner ── */}
      {nowPlaying?.playing && nowPlaying.title && (
        <section className="px-5 sm:px-8 pt-6">
          <div className="relative rounded-xl overflow-hidden border border-primary/40 bg-primary/5">
            {nowPlayingGame?.artUrl && (
              <img
                src={nowPlayingGame.artUrl}
                alt=""
                className="absolute right-0 top-0 h-full w-auto object-cover opacity-15 pointer-events-none"  
              />
            )}
            <div className="relative flex items-center gap-4 px-5 py-4">
              <span className="relative flex size-3 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex size-3 rounded-full bg-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary/70 flex items-center gap-1.5">
                  <Radio className="size-3" /> {t("dashboard.liveNow")}
                </div>
                <div className="font-display text-lg font-bold text-foreground leading-tight truncate">       
                {nowPlaying.title}
                </div>
                {nowPlaying.system && config.showSystemLabels && (
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">        
                {SYSTEMS.find((s) => s.id === nowPlaying.system)?.shortName ?? nowPlaying.system}
                </div>
                )}
                </div>
                {nowPlayingGame && (
                <button
                type="button"
                onClick={() => openGame(nowPlayingGame)}
                className="shrink-0 font-mono text-[10px] uppercase tracking-wider border border-border bg-background/60 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                {t("common.ui.details")}
                </button>
                )}
                </div>
                </div>
                </section>
                )}

                {/* ── Continue Playing hero ── */}
                {continueGame && (
                <section className="px-5 sm:px-8 pt-6">
                <div
                className="relative rounded-xl overflow-hidden border border-card-border min-h-[180px]"       
                data-testid="hero-continue"
                >
                <div
                className="absolute inset-0"
                style={{
                background: `linear-gradient(120deg, hsl(${continueGame.art[0]}) 0%, hsl(${continueGame.art[1]}) 60%, hsl(${continueGame.art[2]}) 100%)`,
                }}
                />
                {continueGame.artUrl && (
                <img
                src={continueGame.artUrl}
                alt=""
                className="absolute right-0 top-0 h-full w-auto object-cover opacity-30 pointer-events-none"  
                />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.75)_0%,rgba(0,0,0,0.4)_55%,rgba(0,0,0,0.1)_100%)]" />
                <div className="relative p-6 sm:p-8 flex flex-col gap-2.5 max-w-xl">
                <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
                {t("dashboard.sections.continuePlaying")}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                {continueGame.title}
                </h2>
                <div className="font-mono text-[11px] text-white/60 uppercase tracking-wider">
                {config.showSystemLabels && (
                <>
                {SYSTEMS.find((s) => s.id === continueGame.system)?.shortName}
                {" · "}
                </>
                )}
                {continueGame.lastPlayed
                ? `${t("common.lastPlayed")} ${formatRelative(continueGame.lastPlayed)}`
                : ""}
                {(continueGame.minutesPlayed ?? 0) > 0
                ? ` · ${fmtHours(continueGame.minutesPlayed ?? 0, t("common.played"))}`
                : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                <Button
                size="lg"
                onClick={() => launchGame(continueGame)}
                className="font-mono uppercase tracking-wider ring-neon"
                data-testid="button-hero-launch"
                >
                <Play className="size-4 fill-current" />
                {t("common.ui.play")}
                </Button>
                <Button
                size="lg"
                variant="outline"
                onClick={() => openGame(continueGame)}
                className="bg-black/70 border-white/35 text-white hover:bg-black/85"
                >
                {t("common.ui.details")}
                </Button>
                </div>
                </div>
                </div>
                </section>
                )}

                <div className="px-5 sm:px-8 py-6 space-y-8">
                {/* ── Stats row ── */}
                <section>
                <SectionHeader title={t("dashboard.sections.overview")} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                icon={<Clock className="size-3" />}
                label={t("dashboard.stats.hoursPlayed")}
                value={fmtHoursShort(totalMinutes)}
                sub={t("dashboard.stats.gamesInLibrary", { count: games.length })}
                accent="text-primary"
                />
                <StatCard
                icon={<Trophy className="size-3" />}
                label={t("dashboard.stats.completed")}
                value={String(completed)}
                sub={t("dashboard.stats.completionRate", { count: completionRate })}
                accent="text-status-online"
                />
                <StatCard
                icon={<ListTodo className="size-3" />}
                label={t("dashboard.stats.backlog")}
                value={String(backlog)}
                sub={backlog > 0 ? t("dashboard.stats.backlogGames", { count: backlog }) : t("dashboard.stats.backlogClear")}
                accent="text-chart-3"
                />
                <StatCard
                icon={<TrendingUp className="size-3" />}
                label={t("dashboard.stats.thisWeek")}
                value={String(thisWeek)}
                sub={
                thisWeek !== lastWeekCount
                ? t("dashboard.stats.vsLastWeek", { count: Number(thisWeek - lastWeekCount) })
                : t("dashboard.stats.sameAsLastWeek")
                }
                accent="text-accent"
                />
                </div>
                </section>

                {/* ── Charts: system breakdown + status donut ── */}
                {(showSystemChart || games.length > 0) && (
                <section>
                <SectionHeader title={t("dashboard.sections.libraryBreakdown")} />
                <div className="grid sm:grid-cols-2 gap-4">
                {showSystemChart && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                {t("dashboard.charts.playTimeBySystem")}
                </div>
                {systemBreakdown.map(({ system, minutes }) => (
                <SystemBar
                  key={system.id}
                  system={system}
                  minutes={minutes}
                  maxMinutes={maxSystemMinutes}
                />
                ))}
                {systemBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.status.startTracking")}
                </p>
                )}
                </div>
                )}
                <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                {t("dashboard.sections.statusBreakdown")}
                </div>
                <StatusDonut counts={statusCounts} total={games.length} />
                </div>
                </div>
                </section>
                )}

                {/* ── Activity ── */}
                <section>
                <SectionHeader title={t("dashboard.sections.activity")} />
                <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                {t("dashboard.activity.trend")}
                </div>
                <ActivityBar thisWeek={thisWeek} lastWeek={lastWeekCount} />
                </div>
                </section>

                {/* ── Game highlights ── */}
                {showHighlights && (
                <section>
                <SectionHeader title={t("dashboard.sections.highlights")} />
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {mostPlayed && (
                <HighlightCard
                label={t("dashboard.highlights.mostPlayed")}
                game={mostPlayed}
                stat={fmtHoursShort(mostPlayed.minutesPlayed ?? 0)}
                statLabel={t("common.played")}
                icon={<Clock className="size-3" />}
                onOpen={openGame}
                showSystem={config.showSystemLabels}
                />
                )}
                {highestRated && (
                <HighlightCard
                label={t("dashboard.highlights.highestRated")}
                game={highestRated}
                stat={`${highestRated.rating}/5`}
                statLabel={t("dashboard.highlights.yourRating")}
                icon={<Star className="size-3" />}
                onOpen={openGame}
                showSystem={config.showSystemLabels}
                />
                )}
                {bestCommunity && (
                <HighlightCard
                label={t("dashboard.highlights.communityFav")}
                game={bestCommunity}
                stat={`${((bestCommunity.communityScore ?? 0) / 2).toFixed(1)}`}
                statLabel="/ 10"
                icon={<Zap className="size-3" />}
                onOpen={openGame}
                showSystem={config.showSystemLabels}
                />
                )}
                </div>
                </section>
                )}

                {/* ── In Progress ── */}
                {inProgress.length > 0 && (
                  <section>
                    <SectionHeader title={t("dashboard.sections.inProgress")} count={inProgress.length} />    
                    <HorizontalShelf>
                      {inProgress.map((g, i) => (
                        <div key={g.id} className="w-44 shrink-0">
                          <GameCard game={g} onOpen={openGame} onToggleFav={handleToggleFav} priority={i < 4} />
                        </div>
                      ))}
                    </HorizontalShelf>
                  </section>
                )}

                {recentlyPlayed.length > 0 && (
                  <section>
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
                  </section>
                )}

                {newAdditions.length > 0 && (
                  <section>
                    <SectionHeader title={t("dashboard.sections.newThisWeek")} count={newAdditions.length} /> 
                    <HorizontalShelf>
                      {newAdditions.map((g, i) => (
                        <div key={g.id} className="w-44 shrink-0">
                          <GameCard game={g} onOpen={openGame} onToggleFav={handleToggleFav} priority={i < 4} />
                        </div>
                      ))}
                    </HorizontalShelf>
                  </section>
                )}
                {/* ── Recent Activity ── */}
                {sessions.length > 0 && (
                <section>
                <SectionHeader title={t("dashboard.sections.recentActivity")} />
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                {sessions.slice(0, 12).map((s, i) => {
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
                className={`flex items-center gap-3 px-4 py-2.5 ${i < sessions.slice(0, 12).length - 1 ? "border-b border-border" : ""}`}
                >
                <History className="size-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 font-medium text-sm truncate">{s.romTitle}</span>
                {config.showSystemLabels && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {system?.shortName ?? s.romSystem}
                  </span>
                )}
                {dur && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{dur}</span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{when}</span>       
                </div>
                );
                })}
                </div>
                </section>
                )}
        {/* ── Browse Systems ── */}
        <section>
          <SectionHeader title={t("dashboard.sections.browseSystems")} href="/library/all" />
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {SYSTEMS.map((s) => {
              const count = roms.filter((r) => r.system === s.id).length;
              return (
                <Link key={s.id} href={`/library/${s.id}`}>
                  <div className="rounded-xl overflow-hidden aspect-[4/3] cursor-pointer hover:scale-[1.02] transition-transform">
                    <SystemTile system={s} />
                  </div>
                  <div className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground text-center">
                    {s.shortName} · {count}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
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
