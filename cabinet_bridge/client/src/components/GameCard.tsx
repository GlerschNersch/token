import React, { memo, useCallback, useRef, useState, useEffect } from "react";
import { GameArt } from "@/components/GameArt";
import { SYSTEMS, type Game } from "@/data/library";
import { formatRelative } from "@/lib/integration";
import { Heart, Info, Star, Clock } from "lucide-react";
import { queryClient, apiUrl } from "@/lib/queryClient";
import { useIntegration } from "@/lib/integration";
import { useTranslation } from "react-i18next";

// ── Play-status badge ─────────────────────────────────────────────────────────
function PlayStatusDot({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  if (!status || status === "unset") return null;
  
  const STATUS_META: Record<string, { label: string; color: string }> = {
    playing:   { label: t("dashboard.status.playing"),   color: "bg-amber-400" },
    beaten:    { label: t("dashboard.status.beaten"),    color: "bg-green-500" },
    completed: { label: t("dashboard.status.completed"), color: "bg-violet-500" },
  };

  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span
      title={meta.label}
      className={`inline-block size-2 rounded-full shrink-0 ${meta.color}`}
    />
  );
}

/**
 * MD3 Elevated Card — 16px large shape, tonal surface, state layer on hover/press.
 * Optimized with Intersection Observer for performance.
 */
export const GameCard = memo(function GameCard({
  game,
  onOpen,
  onToggleFav,
  focused = false,
  showSaveThumb = false,
  priority = false,
}: {
  game: Game;
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
  focused?: boolean;
  showSaveThumb?: boolean;
  priority?: boolean;
}) {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const system = SYSTEMS.find((s) => s.id === game.system);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [isVisible, setIsVisible] = useState(priority);
  const [videoFailed, setVideoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  // Disable video on touch devices to save battery/bandwidth
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const showVideo = !!game.videoUrl && !videoFailed && !showSaveThumb && !isTouch;

  useEffect(() => {
    if (priority || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" } // Load early for smoother scrolling
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const saveThumbUrl = game.romId
    ? `/api/roms/${game.romId}/save-thumb/auto?t=${game.lastPlayed}`
    : null;

  const prefetchData = useCallback(() => {
    if (!game.romId) return;

    // Prefetch HLTB data
    queryClient.prefetchQuery({
      queryKey: ["hltb", game.romId],
      queryFn: async () => {
        const res = await fetch(apiUrl(`/api/roms/${game.romId}/hltb`));
        if (!res.ok) return { found: false };
        return res.json();
      },
      staleTime: 1000 * 60 * 60 * 24, // 1 day
    });

    // Prefetch Save States
    queryClient.prefetchQuery({
      queryKey: ["save-states", game.romId],
      queryFn: async () => {
        const res = await fetch(apiUrl(`/api/roms/${game.romId}/save-states`));
        if (!res.ok) return [];
        return res.json();
      },
    });
  }, [game.romId]);

  const handleMouseEnter = useCallback(() => {
    if (isTouch) return;
    prefetchData();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => setVideoFailed(true));
    }
  }, [prefetchData, isTouch]);

  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);
  const handleOpen    = useCallback(() => onOpen(game), [game, onOpen]);
  const handleFav     = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onToggleFav(game); }, [game, onToggleFav]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(game); }
  }, [game, onOpen]);

  const isNew = game.createdAt != null && Date.now() - game.createdAt < 7 * 24 * 60 * 60 * 1000;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={[
        "group relative rounded-xl overflow-hidden bg-card min-h-[140px]",
        "md3-state md3-state-on-surface",
        "focus:outline-none [touch-action:manipulation]",
        "transition-[box-shadow,transform] duration-150 hover-tilt-scale",
        focused
          ? "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_18px_hsl(var(--primary)/0.35)] scale-[1.02]"
          : [
              "shadow-[0_1px_2px_hsl(0_0%_0%/0.3),0_2px_6px_1px_hsl(0_0%_0%/0.15)]",
              "hover:shadow-[0_1px_2px_hsl(0_0%_0%/0.3),0_4px_12px_2px_hsl(0_0%_0%/0.25)]",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            ].join(" "),
      ].join(" ")}
      data-testid={`card-game-${game.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={prefetchData}
    >
      {isVisible ? (
        <>
          {/* ── Art / video ── */}
          <div className="aspect-[16/10] relative">
            {showSaveThumb && saveThumbUrl && !thumbFailed ? (
              <img
                src={saveThumbUrl}
                alt={`Last session of ${game.title}`}
                onError={() => setThumbFailed(true)}
                className="w-full h-full object-cover"
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
              />
            ) : (
              <GameArt game={game} priority={priority} />
            )}
            {game.isMultiDisc && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 backdrop-blur-sm">
                {t("common.ui.multiDisc")}
              </div>
            )}
            {showVideo && (
              <video
                ref={videoRef}
                src={`/api/roms/${game.romId}/video`}
                muted loop playsInline preload="none"
                onError={() => setVideoFailed(true)}
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              />
            )}
          </div>

          {/* ── "New" badge ── */}
          {isNew && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider bg-primary-container/80 text-[hsl(var(--on-primary-container))] pointer-events-none backdrop-blur-sm">
              {t("common.ui.new")}
            </div>
          )}

          {/* ── Favorite button ── */}
          <button
            type="button"
            onClick={handleFav}
            style={{ touchAction: "manipulation" }}
            className={[
              "absolute top-2 right-2 size-11 rounded-full flex items-center justify-center z-10",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "md3-state",
              game.favorite
                ? "bg-primary-container text-primary md3-state-primary"
                : "bg-black/50 backdrop-blur-sm text-white/80 md3-state-on-surface hover:bg-black/70",
            ].join(" ")}
            aria-label={game.favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={!!game.favorite}
            data-testid={`button-fav-${game.id}`}
          >
            <Heart className={`size-5 ${game.favorite ? "fill-current" : ""}`} />
          </button>

          {/* ── Hover overlay ── */}
          <button
            type="button"
            onClick={handleOpen}
            className="absolute inset-0 flex flex-col justify-between bg-black/70 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 hide-on-touch transition-opacity focus:outline-none focus-visible:pointer-events-auto focus-visible:opacity-100 p-3"
            data-testid={`button-details-${game.id}`}
            aria-label={`View details for ${game.title}`}
          >
            {game.description ? (
              <p className="text-white/90 text-[11px] leading-[1.4] line-clamp-4 text-left">
                {game.description}
              </p>
            ) : (
              <span />
            )}
            <span className="self-center flex items-center gap-2 px-4 py-2 rounded-full bg-primary-container text-[hsl(var(--on-primary-container))] font-mono text-xs font-bold uppercase tracking-wider">
              <Info className="size-3.5" /> {t("common.ui.details")}
            </span>
          </button>

          {/* ── Card footer ── */}
          <div className="px-3 pt-2 pb-2.5 border-t border-card-border/60 space-y-0.5">
            <div
              className="text-[12px] font-semibold text-foreground leading-tight line-clamp-1"
              data-testid={`text-title-${game.id}`}
            >
              {game.title}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                <PlayStatusDot status={game.playStatus} />
                {config.showSystemLabels && (
                  <span
                    className="md-label-small text-muted-foreground uppercase tracking-[0.08em] truncate"
                    data-testid={`text-system-${game.id}`}
                  >
                    {system?.shortName ?? game.system}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                {game.minutesPlayed && game.minutesPlayed > 0 ? (
                  <span className="flex items-center gap-0.5 md-label-small text-foreground/50 whitespace-nowrap" data-testid={`text-playtime-${game.id}`} title="Total play time">
                    <Clock className="size-2.5" />
                    {game.minutesPlayed >= 60
                      ? `${Math.floor(game.minutesPlayed / 60)}h${game.minutesPlayed % 60 > 0 ? ` ${game.minutesPlayed % 60}m` : ""}`
                      : `${game.minutesPlayed}m`}
                  </span>
                ) : game.lastPlayed ? (
                  <span className="md-label-small text-foreground/60 whitespace-nowrap" data-testid={`text-lastplayed-${game.id}`}>
                    {formatRelative(game.lastPlayed)}
                  </span>
                ) : null}
                <span className="flex items-center gap-0.5 md-label-small text-foreground/60" data-testid={`text-rating-${game.id}`}>
                  <Star className="size-3 fill-current text-chart-3" />
                  {game.rating > 0 ? game.rating : "—"}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="aspect-[16/10] bg-muted/20 animate-pulse" />
      )}
    </div>
  );
});

/** MD3 animated skeleton — matches elevated card shape */
export function GameCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card shadow-[0_1px_2px_hsl(0_0%_0%/0.3),0_2px_6px_1px_hsl(0_0%_0%/0.15)] animate-pulse">
      <div className="aspect-[16/10] bg-muted/40" />
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="h-2.5 w-16 rounded-full bg-muted/40" />
        <div className="h-2.5 w-8 rounded-full bg-muted/40" />
      </div>
    </div>
  );
}
