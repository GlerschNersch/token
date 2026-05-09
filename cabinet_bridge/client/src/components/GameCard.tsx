import { memo, useCallback, useRef, useState } from "react";
import { GameArt } from "@/components/GameArt";
import { SYSTEMS, type Game } from "@/data/library";
import { formatRelative } from "@/lib/integration";
import { Heart, Info, Star } from "lucide-react";

export const GameCard = memo(function GameCard({
  game,
  onOpen,
  onToggleFav,
  focused = false,
  showSaveThumb = false,
}: {
  game: Game;
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
  focused?: boolean;
  showSaveThumb?: boolean;
}) {
  const system = SYSTEMS.find((s) => s.id === game.system);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showVideo = !!game.videoUrl && !videoFailed && !showSaveThumb;
  const saveThumbUrl = game.romId ? `/api/roms/${game.romId}/save-thumb/auto?t=${game.lastPlayed}` : null;

  const handleMouseEnter = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => setVideoFailed(true));
    }
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const handleOpen = useCallback(() => onOpen(game), [game, onOpen]);
  const handleFav = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onToggleFav(game); },
    [game, onToggleFav],
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(game); }
    },
    [game, onOpen],
  );

  const isNew = game.createdAt != null && Date.now() - game.createdAt < 7 * 24 * 60 * 60 * 1000;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={[
        "group relative rounded-lg overflow-hidden border bg-card hover-elevate active-elevate-2 focus:outline-none transition-[border-color,box-shadow] duration-100 [touch-action:manipulation]",
        focused
          ? "border-accent ring-2 ring-accent/60 ring-offset-1 ring-offset-background shadow-[0_0_12px_2px_hsl(var(--accent)/0.35)]"
          : "border-card-border focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      ].join(" ")}
      data-testid={`card-game-${game.id}`}
      onMouseEnter={showVideo ? handleMouseEnter : undefined}
      onMouseLeave={showVideo ? handleMouseLeave : undefined}
    >
      <div className="aspect-[16/10] relative">
        {showSaveThumb && saveThumbUrl && !thumbFailed ? (
          <img
            src={saveThumbUrl}
            alt={`Last session of ${game.title}`}
            onError={() => setThumbFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <GameArt game={game} />
        )}
        {game.isMultiDisc && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 backdrop-blur-sm">
            Multi-Disc
          </div>
        )}
        {showVideo && (
          <video
            ref={videoRef}
            src={`/api/roms/${game.romId}/video`}
            muted
            loop
            playsInline
            preload="none"
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          />
        )}
      </div>

      {isNew && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30 pointer-events-none">
          New
        </div>
      )}

      <button
        type="button"
        onClick={handleFav}
        style={{ touchAction: "manipulation" }}
        className="absolute top-2 right-2 size-8 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={game.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={!!game.favorite}
        data-testid={`button-fav-${game.id}`}
      >
        <Heart
          className={`size-4 ${game.favorite ? "fill-primary text-primary" : "text-white/80"}`}
        />
      </button>

      {/* Hover overlay — description preview + details button */}
      <button
        type="button"
        onClick={handleOpen}
        className="absolute inset-0 flex flex-col justify-between bg-black/70 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:pointer-events-auto focus-visible:opacity-100 p-3"
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
        <span className="self-center flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider ring-neon">
          <Info className="size-3.5" /> Details
        </span>
      </button>

      <div className="px-3 py-2.5 flex items-center justify-between gap-2 text-[10px] 2xl:text-[11px] font-mono text-muted-foreground border-t border-card-border">
        <span className="truncate uppercase tracking-wider min-w-0" data-testid={`text-system-${game.id}`}>
          {system?.shortName ?? game.system}
        </span>
        <div className="flex items-center gap-1.5 2xl:gap-2 shrink-0 whitespace-nowrap">
          {game.lastPlayed ? (
            <span className="text-foreground/70 whitespace-nowrap" data-testid={`text-lastplayed-${game.id}`}>
              {formatRelative(game.lastPlayed)}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5 whitespace-nowrap" data-testid={`text-rating-${game.id}`}>
            <Star className="size-3 fill-current text-chart-3" />
            {game.rating > 0 ? game.rating : "\u2014"}
          </span>
        </div>
      </div>
    </div>
  );
});

/** Animated placeholder shown while the library is loading. */
export function GameCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-card-border bg-card animate-pulse">
      <div className="aspect-[16/10] bg-muted/40" />
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="h-2.5 w-16 rounded bg-muted/40" />
        <div className="h-2.5 w-8 rounded bg-muted/40" />
      </div>
    </div>
  );
}
