import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GameArt } from "@/components/GameArt";
import { SYSTEMS, type Game, gameLaunchEndpoint } from "@/data/library";
import { useIntegration, formatRelative } from "@/lib/integration";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GameCollectionWithItems, UploadedRom, RomSaveSlot, GameCheatCode } from "@shared/schema";
import { Heart, Play, Clock, Users, Star, Folder, Plus, ChevronDown, ChevronUp, Hash, Loader2, ImagePlus, Trash2, Save, Zap, ToggleLeft, ToggleRight } from "lucide-react";

export function GameDetailDialog({
  game,
  onClose,
  onToggleFav,
  onRate,
  collections,
  onCreateCollection,
  onToggleCollection,
  onSetStatus,
  profileId = 1,
}: {
  game: Game | null;
  onClose: () => void;
  onToggleFav: (g: Game) => void;
  onRate: (g: Game, rating: number) => void;
  collections: GameCollectionWithItems[];
  onCreateCollection: () => void;
  onToggleCollection: (collectionId: number, game: Game, selected: boolean) => void;
  onSetStatus?: (g: Game, status: string) => void;
  profileId?: number;
}) {
  const { dispatch, config } = useIntegration();
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);
  const [wheelArtError, setWheelArtError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [scrapingArt, setScrapingArt] = useState(false);
  const [selectedRomId, setSelectedRomId] = useState<number | null>(null);

  const { data: raProgress, isLoading: loadingRa } = useQuery({
    queryKey: ["ra-progress", game?.raGameId],
    queryFn: async () => {
      if (!game?.raGameId) return null;
      const res = await fetch(`/api/retroachievements/user-progress/${game.raGameId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!game?.raGameId && !!config.raUsername && !!config.raToken,
  });

  const { data: saveSlots = [], refetch: refetchSlots } = useQuery<RomSaveSlot[]>({
    queryKey: ["save-states", game?.romId],
    queryFn: async () => {
      const res = await fetch(`/api/roms/${game!.romId}/save-states`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!game?.romId,
  });

  const deleteSlot = async (slot: number) => {
    if (!game?.romId) return;
    await apiRequest("DELETE", `/api/roms/${game.romId}/save-states/${slot}`);
    await refetchSlots();
  };

  const [cheatDesc, setCheatDesc] = useState("");
  const [cheatCode, setCheatCode] = useState("");
  const [addingCheat, setAddingCheat] = useState(false);

  const { data: cheats = [], refetch: refetchCheats } = useQuery<GameCheatCode[]>({
    queryKey: ["cheats", game?.romId, profileId],
    queryFn: async () => {
      const res = await fetch(`/api/roms/${game!.romId}/cheats?profileId=${profileId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!game?.romId,
  });

  const addCheat = async () => {
    if (!game?.romId || !cheatDesc.trim() || !cheatCode.trim()) return;
    setAddingCheat(true);
    try {
      await apiRequest("POST", `/api/roms/${game.romId}/cheats`, {
        description: cheatDesc.trim(),
        code: cheatCode.trim(),
        profileId,
      });
      setCheatDesc("");
      setCheatCode("");
      await refetchCheats();
    } finally {
      setAddingCheat(false);
    }
  };

  const toggleCheat = async (id: number, enabled: boolean) => {
    await apiRequest("PATCH", `/api/cheats/${id}`, { enabled });
    await refetchCheats();
  };

  const deleteCheat = async (id: number) => {
    await apiRequest("DELETE", `/api/cheats/${id}`);
    await refetchCheats();
  };

  const refreshArt = useCallback(async () => {
    if (!game?.romId) return;
    setScrapingArt(true);
    try {
      const res = await apiRequest("POST", `/api/roms/${game.romId}/scrape-art`);
      const data = await res.json() as UploadedRom;
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      if (data.artUrl) {
        toast({ title: "Art updated", description: "Cover art fetched successfully." });
      } else {
        toast({ title: "No art found", description: "ScreenScraper couldn't match this title.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Art refresh failed", description: String(err), variant: "destructive" });
    } finally {
      setScrapingArt(false);
    }
  }, [game, toast]);

  if (!game) return null;
  const system = SYSTEMS.find((s) => s.id === game.system);
  const endpoint = gameLaunchEndpoint(game);

  const launch = async () => {
    const romId = selectedRomId || game.romId;
    if (romId) {
      setLaunching(true);
      const returnTo = encodeURIComponent(window.location.href);
      const playerUrl = apiUrl(`/api/roms/${romId}/player?return=${returnTo}&profile=${profileId}`);
      try {
        const probe = await fetch(playerUrl, { method: "HEAD" });
        if (!probe.ok) {
          const msg = probe.status === 404
            ? "ROM file not found on the server. It may have been deleted."
            : `Server returned ${probe.status}. Try restarting the HomeArcade add-on.`;
          toast({ title: "Couldn't launch game", description: msg, variant: "destructive" });
          setLaunching(false);
          return;
        }
      } catch {
        toast({
          title: "Couldn't reach server",
          description: "HomeArcade server is not responding. Check that the add-on is running.",
          variant: "destructive",
        });
        setLaunching(false);
        return;
      }
      onClose();
      window.location.href = playerUrl;
      return;
    }
    void dispatch({
      actionId: `launch_game:${game.id}`,
      label: `Launch ${game.title}`,
      endpoint,
      onSettle: onClose,
    });
  };

  // Community score: ScreenScraper is /20 scale; convert to /10 for display
  const scoreDisplay = game.communityScore != null
    ? `${(game.communityScore / 2).toFixed(1)}/10`
    : null;

  // Genre pills (comma-separated string → array)
  const genrePills = game.genre
    ? game.genre.split(",").map((g) => g.trim()).filter(Boolean)
    : [];

  const showWheelArt = !!game.wheelArtUrl && !wheelArtError;

  // Play time display
  const playTimeDisplay = (() => {
    const m = game.minutesPlayed ?? 0;
    if (!m) return "—";
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  })();

  // Description: clamp unless expanded
  const descLong = game.description && game.description.length > 220;

  return (
    <Dialog open={!!game} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[92dvh] p-0 overflow-y-auto bg-card border-card-border"
        data-testid="dialog-game-detail"
      >
        <div className="grid sm:grid-cols-[220px_1fr]">
          {/* Left panel — box art */}
          <div className="relative sm:h-auto h-48 group">
            <div className="absolute inset-0">
              <GameArt game={game} />
            </div>
            {showWheelArt && (
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-3 px-3 pointer-events-none">
                <img
                  src={game.wheelArtUrl!}
                  alt={`${game.title} logo`}
                  onError={() => setWheelArtError(true)}
                  className="max-h-14 max-w-full object-contain drop-shadow-lg"
                  style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
                  decoding="async"
                />
              </div>
            )}
            {/* Refresh art button — appears on hover */}
            {game.romId && (
              <button
                type="button"
                onClick={refreshArt}
                disabled={scrapingArt}
                className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md border border-white/20 bg-black/55 backdrop-blur-sm px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-white/80 hover:bg-black/75 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                aria-label="Refresh cover art"
                data-testid="button-refresh-art"
              >
                {scrapingArt
                  ? <Loader2 className="size-3 animate-spin" />
                  : <ImagePlus className="size-3" />}
                {scrapingArt ? "Scraping…" : "Refresh art"}
              </button>
            )}
          </div>

          {/* Right panel */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 min-w-0">
            {/* Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>{system?.shortName}</span>
                {game.year > 0 && (
                  <>
                    <span>·</span>
                    <span>{game.year}</span>
                  </>
                )}
              </div>
              <DialogTitle
                className="font-display text-xl font-bold leading-tight"
                data-testid="text-game-title"
              >
                {game.title}
              </DialogTitle>
              {(game.developer || game.publisher) && (
                <DialogDescription className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex flex-wrap gap-x-3">
                  {game.developer && <span>{game.developer}</span>}
                  {game.developer && game.publisher && <span>·</span>}
                  {game.publisher && <span>{game.publisher}</span>}
                </DialogDescription>
              )}
              {genrePills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {genrePills.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center rounded-full border border-border bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {/* Description with expand/collapse */}
              {game.description && (
                <div className="pt-1">
                  <p className={`text-sm text-muted-foreground leading-relaxed ${descExpanded ? "" : "line-clamp-3"}`}>
                    {game.description}
                  </p>
                  {descLong && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:underline focus:outline-none"
                      data-testid="button-expand-desc"
                    >
                      {descExpanded
                        ? <><ChevronUp className="size-3" /> Show less</>
                        : <><ChevronDown className="size-3" /> Show more</>}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Stat icon={<Star className="size-3.5" />} label="Community" value={scoreDisplay ?? "—"} />
              <Stat icon={<Users className="size-3.5" />} label="Players" value={game.players !== "Uploaded ROM" ? (game.players || "—") : "—"} />
              <Stat icon={<Clock className="size-3.5" />} label="Play time" value={playTimeDisplay} />
              <Stat icon={<Hash className="size-3.5" />} label="Play count" value={game.playCount != null && game.playCount > 0 ? String(game.playCount) : "—"} />
            </div>

            {/* Your Rating */}
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

            {/* RetroAchievements Progress */}
            {raProgress && raProgress.NumAchievements > 0 && (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    RetroAchievements
                  </div>
                  <div className="font-mono text-[10px] text-primary">
                    {raProgress.NumAwarded} / {raProgress.NumAchievements}
                  </div>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(raProgress.NumAwarded / raProgress.NumAchievements) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Cheats */}
            {game.romId && (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="size-3.5 text-muted-foreground" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex-1">
                    Cheats
                  </div>
                  {cheats.length > 0 && (
                    <span className="font-mono text-[9px] text-muted-foreground/50">
                      {cheats.filter((c) => c.enabled).length}/{cheats.length} active
                    </span>
                  )}
                </div>
                {/* Add form */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Description"
                    value={cheatDesc}
                    onChange={(e) => setCheatDesc(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border border-border bg-background/70 px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Code"
                    value={cheatCode}
                    onChange={(e) => setCheatCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") void addCheat(); }}
                    className="w-[90px] shrink-0 rounded-md border border-border bg-background/70 px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void addCheat()}
                    disabled={addingCheat || !cheatDesc.trim() || !cheatCode.trim()}
                    className="shrink-0 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingCheat ? <Loader2 className="size-3 animate-spin" /> : "+ Add"}
                  </button>
                </div>
                {/* Cheat list */}
                {cheats.length === 0 ? (
                  <p className="font-mono text-[10px] text-muted-foreground/40 text-center py-2">
                    No cheats yet. Add a GameShark or Action Replay code above.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {cheats.map((c) => (
                      <CheatRow
                        key={c.id}
                        cheat={c}
                        onToggle={() => toggleCheat(c.id, !c.enabled)}
                        onDelete={() => deleteCheat(c.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save States */}
            {saveSlots.length > 0 && (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Save className="size-3.5 text-muted-foreground" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Save States
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {saveSlots.map((s) => (
                    <SaveSlotCard
                      key={s.slot}
                      slot={s}
                      romId={game.romId!}
                      onDelete={() => deleteSlot(s.slot)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Discs (Multi-Disc Set) */}
            {game.isMultiDisc && game.discIds && (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Discs in this set
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.discIds.map((id, index) => {
                    const isSelected = (selectedRomId || game.romId) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedRomId(id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isSelected
                            ? "border-primary/60 bg-primary/15 text-primary"
                            : "border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                        data-testid={`button-disc-${index + 1}`}
                      >
                        Disc {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Play Status */}
            {game.romId && onSetStatus ? (
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Play Status
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Play status" data-testid="group-play-status">
                  {([
                    { id: "backlog", label: "Backlog" },
                    { id: "playing", label: "Playing" },
                    { id: "completed", label: "Completed" },
                    { id: "dropped", label: "Dropped" },
                  ] as const).map(({ id, label }) => {
                    const active = (game.playStatus ?? "unset") === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSetStatus(game, active ? "unset" : id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          active
                            ? "border-primary/60 bg-primary/15 text-primary"
                            : "border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                        data-testid={`button-status-${id}`}
                      >
                        {label}
                        {active && <span className="text-primary/70">×</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Collections */}
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

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="lg"
                onClick={launch}
                className="font-mono uppercase tracking-wider"
                data-testid="button-detail-launch"
              >
                <Play className="size-4 fill-current" /> {launching ? "Launching…" : game.romId ? "Play" : "Launch"}
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
    <div className="rounded-md border border-border bg-background/50 px-2.5 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] truncate">{label}</span>
      </div>
      <div className="mt-1 font-mono text-xs font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}

function SaveSlotCard({
  slot,
  romId,
  onDelete,
}: {
  slot: RomSaveSlot;
  romId: number;
  onDelete: () => void;
}) {
  const [thumbError, setThumbError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const thumbUrl = `/api/roms/${romId}/save-thumb/${slot.slot}`;

  const timeAgo = (() => {
    const diffMs = Date.now() - slot.updatedAt;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  })();

  return (
    <div className="group relative rounded-lg border border-border bg-background/70 overflow-hidden w-[88px] shrink-0">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-muted flex items-center justify-center">
        {!thumbError ? (
          <img
            src={thumbUrl}
            alt={`Slot ${slot.slot}`}
            className="w-full h-full object-cover"
            onError={() => setThumbError(true)}
            decoding="async"
          />
        ) : (
          <Save className="size-5 text-muted-foreground/40" />
        )}
        {/* Delete button */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {confirming ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onDelete}
                className="text-[9px] font-mono uppercase tracking-wider text-red-400 hover:text-red-300"
              >
                Delete?
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full bg-black/60 p-1.5 text-white/70 hover:text-white transition-colors"
              aria-label="Delete save state"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
      {/* Label + time */}
      <div className="px-1.5 py-1">
        <div className="font-mono text-[9px] font-semibold text-foreground truncate">
          {slot.label}
        </div>
        <div className="font-mono text-[8px] text-muted-foreground/60 truncate">
          {timeAgo}
        </div>
      </div>
    </div>
  );
}

function CheatRow({
  cheat,
  onToggle,
  onDelete,
}: {
  cheat: GameCheatCode;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-2">
      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={cheat.enabled}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={cheat.enabled ? "Disable cheat" : "Enable cheat"}
      >
        {cheat.enabled
          ? <ToggleRight className="size-5 text-primary" />
          : <ToggleLeft className="size-5" />}
      </button>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`font-mono text-[11px] font-semibold truncate ${cheat.enabled ? "text-foreground" : "text-muted-foreground/50"}`}>
          {cheat.description}
        </div>
        <div className="font-mono text-[9px] text-muted-foreground/50 truncate tracking-wider">
          {cheat.code}
        </div>
      </div>
      {/* Delete */}
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[9px] uppercase tracking-wider text-red-400 hover:text-red-300"
          >
            Delete?
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded border border-border bg-background/70 p-1 text-muted-foreground/50 hover:text-destructive hover:border-destructive/40 transition-colors"
          aria-label="Delete cheat"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}
