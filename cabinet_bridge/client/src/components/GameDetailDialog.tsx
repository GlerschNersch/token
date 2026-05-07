import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GameArt } from "@/components/GameArt";
import { SYSTEMS, type Game, gameLaunchEndpoint } from "@/data/library";
import { useIntegration, formatRelative } from "@/lib/integration";
import { apiUrl } from "@/lib/queryClient";
import type { GameCollectionWithItems } from "@shared/schema";
import { Heart, Play, Clock, Users, Star, Folder, Plus } from "lucide-react";

export function GameDetailDialog({
  game,
  onClose,
  onToggleFav,
  onRate,
  collections,
  onCreateCollection,
  onToggleCollection,
}: {
  game: Game | null;
  onClose: () => void;
  onToggleFav: (g: Game) => void;
  onRate: (g: Game, rating: number) => void;
  collections: GameCollectionWithItems[];
  onCreateCollection: () => void;
  onToggleCollection: (collectionId: number, game: Game, selected: boolean) => void;
}) {
  const { dispatch } = useIntegration();

  if (!game) return null;
  const system = SYSTEMS.find((s) => s.id === game.system);
  const endpoint = gameLaunchEndpoint(game);

  const launch = () => {
    if (game.romId) {
      onClose();
      const returnTo = encodeURIComponent(window.location.href);
      const playerUrl = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
      const opened = window.open(playerUrl, "_blank", "noopener");
      if (!opened) {
        window.location.href = playerUrl;
      }
      return;
    }
    void dispatch({
      actionId: `launch_game:${game.id}`,
      label: `Launch ${game.title}`,
      endpoint,
      onSettle: onClose,
    });
  };

  return (
    <Dialog open={!!game} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[92dvh] p-0 overflow-y-auto bg-card border-card-border"
        data-testid="dialog-game-detail"
      >
        <div className="grid sm:grid-cols-[200px_1fr]">
          <div className="h-36 sm:h-auto">
            <GameArt game={game} />
          </div>
          <div className="p-5 sm:p-6 flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>{system?.shortName}</span>
                <span>·</span>
                <span>{game.year}</span>
                <span>·</span>
                <span>{game.genre}</span>
              </div>
              <DialogTitle
                className="font-display text-xl font-bold leading-tight"
                data-testid="text-game-title"
              >
                {game.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Uploaded ROMs open in the browser player. External catalog items can
                still launch through Home Assistant webhooks.
              </DialogDescription>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat
                icon={<Star className="size-3.5" />}
                label="Rating"
                value={game.rating > 0 ? `${game.rating} / 5` : "Unrated"}
              />
              <Stat icon={<Users className="size-3.5" />} label="Players" value={game.players} />
              <Stat
                icon={<Clock className="size-3.5" />}
                label="Last played"
                value={game.lastPlayed ? formatRelative(game.lastPlayed) : "—"}
              />
            </div>

            {(game.description || game.developer || game.publisher) && (
              <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                {game.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {game.description}
                  </p>
                )}
                {(game.developer || game.publisher) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
                    {game.developer && <span><span className="uppercase tracking-wider">Dev</span> · {game.developer}</span>}
                    {game.publisher && <span><span className="uppercase tracking-wider">Pub</span> · {game.publisher}</span>}
                  </div>
                )}
                {game.romHash && (
                  <div className="font-mono text-[10px] text-muted-foreground/60 mt-1 select-all" title="MD5 hash — click to select">
                    <span className="uppercase tracking-wider">MD5</span> · {game.romHash}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Your Rating
              </div>
              <div
                className="flex items-center gap-1"
                role="radiogroup"
                aria-label={`Rate ${game.title}`}
                data-testid="group-game-rating"
              >
                {[1, 2, 3, 4, 5].map((rating) => {
                  const selected = game.rating === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Rate ${rating} out of 5`}
                      onClick={() => onRate(game, rating)}
                      className="size-9 rounded-md border border-border bg-background/70 flex items-center justify-center hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      data-testid={`button-rate-${rating}`}
                    >
                      <Star
                        className={`size-4 ${
                          game.rating >= rating ? "fill-primary text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  );
                })}
                {game.rating > 0 ? (
                  <button
                    type="button"
                    onClick={() => onRate(game, 0)}
                    className="ml-2 h-9 px-3 rounded-md border border-border bg-background/70 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid="button-clear-rating"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {game.romId ? (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Collections
                  </div>
                  <button
                    type="button"
                    onClick={onCreateCollection}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid="button-dialog-create-collection"
                  >
                    <Plus className="size-3" /> New
                  </button>
                </div>
                {collections.length > 0 ? (
                  <div className="flex flex-wrap gap-2" data-testid="group-game-collections">
                    {collections.map((collection) => {
                      const selected = collection.romIds.includes(game.romId!);
                      return (
                        <button
                          key={collection.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onToggleCollection(collection.id, game, !selected)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            selected
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border bg-background/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                          data-testid={`button-toggle-collection-${collection.id}`}
                        >
                          <Folder className="size-3" />
                          {collection.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-collections">
                    Create a collection like RPGs, Couch Co-op, or Backlog, then add this game to it.
                  </p>
                )}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                {game.romId ? "Direct Player" : "HA Webhook"}
              </div>
              <code
                className="font-mono text-[12px] text-foreground break-all"
                data-testid="text-game-endpoint"
              >
                {game.romId ? `/api/roms/${game.romId}/player` : `POST ${endpoint}`}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="lg"
                onClick={launch}
                className="font-mono uppercase tracking-wider"
                data-testid="button-detail-launch"
              >
                <Play className="size-4 fill-current" /> {game.romId ? "Play" : "Launch"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onToggleFav(game)}
                data-testid="button-detail-fav"
                aria-pressed={!!game.favorite}
              >
                <Heart
                  className={`size-4 ${
                    game.favorite ? "fill-primary text-primary" : ""
                  }`}
                />
                {game.favorite ? "Favorited" : "Favorite"}
              </Button>
              <Button size="lg" variant="ghost" onClick={onClose} data-testid="button-detail-close">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
