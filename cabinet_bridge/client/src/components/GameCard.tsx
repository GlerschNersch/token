import { GameArt } from "@/components/GameArt";
import { SYSTEMS, type Game } from "@/data/library";
import { formatRelative } from "@/lib/integration";
import { Heart, Info, Star } from "lucide-react";

export function GameCard({
  game,
  onOpen,
  onToggleFav,
}: {
  game: Game;
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
}) {
  const system = SYSTEMS.find((s) => s.id === game.system);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onOpen(game);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(game);
        }
      }}
      className="group relative rounded-lg overflow-hidden border border-card-border bg-card hover-elevate active-elevate-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-testid={`card-game-${game.id}`}
    >
      <div className="aspect-[16/10]">
        <GameArt game={game} />
      </div>

      {/* Top-left NEW badge */}
      {(() => {
        const isNew = game.createdAt && Date.now() - game.createdAt < 7 * 24 * 60 * 60 * 1000;
        return isNew ? (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30 pointer-events-none">
            New
          </div>
        ) : null;
      })()}

      {/* Top-right favorite */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(game);
        }}
        className="absolute top-2 right-2 size-8 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={game.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={!!game.favorite}
        data-testid={`button-fav-${game.id}`}
      >
        <Heart
          className={`size-4 ${game.favorite ? "fill-primary text-primary" : "text-white/80"}`}
        />
      </button>

      {/* Hover-only details overlay */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(game);
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:pointer-events-auto focus-visible:opacity-100"
        data-testid={`button-details-${game.id}`}
        aria-label={`View details for ${game.title}`}
      >
        <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider ring-neon">
          <Info className="size-3.5" /> Details
        </span>
      </button>

      {/* Meta footer below art */}
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
            {game.rating > 0 ? game.rating : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
