import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar, type Filter } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { RightPanel } from "@/components/RightPanel";
import { GameCard } from "@/components/GameCard";
import { GameDetailDialog } from "@/components/GameDetailDialog";
import { SystemTile } from "@/components/GameArt";
import { RomUpload } from "@/components/RomUpload";
import { GAMES, SYSTEMS, type Game, type SystemId, uploadedRomToGame } from "@/data/library";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, SlidersHorizontal, LayoutGrid, LayoutList, Shuffle } from "lucide-react";
import { useIntegration } from "@/lib/integration";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { filterToPath } from "@/lib/filter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { GameCollectionWithItems, UploadedRom } from "@shared/schema";
import { WelcomeDialog } from "@/components/WelcomeDialog";

type Sort = "title" | "year" | "recent" | "rating" | "plays";

export default function Home({
  filter,
  arcadeMode,
  onToggleArcade,
}: {
  filter: Filter;
  arcadeMode: boolean;
  onToggleArcade: () => void;
}) {
  const [, navigate] = useLocation();
  const goToFilter = (next: Filter) => navigate(filterToPath(next));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [openGame, setOpenGame] = useState<Game | null>(null);
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const [ratingOverrides, setRatingOverrides] = useState<Record<string, number>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { pc } = useIntegration();
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });
  const { data: kiosk } = useQuery<{ enabled: boolean; collectionId: number | null; hasPin: boolean }>({
    queryKey: ["/api/kiosk"],
  });
  const kioskMode = !!kiosk?.enabled;
  const rateUploadedRom = useMutation({
    mutationFn: async ({ game, rating }: { game: Game; rating: number }) => {
      if (!game.romId) return null;
      const res = await apiRequest("PATCH", `/api/roms/${game.romId}/rating`, { rating });
      return (await res.json()) as UploadedRom;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
    },
  });
  const favoriteUploadedRom = useMutation({
    mutationFn: async ({ game, favorite }: { game: Game; favorite: boolean }) => {
      if (!game.romId) return null;
      const res = await apiRequest("PATCH", `/api/roms/${game.romId}/favorite`, { favorite });
      return (await res.json()) as UploadedRom;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
    },
  });
  const setStatusMutation = useMutation({
    mutationFn: async ({ game, playStatus }: { game: Game; playStatus: string }) => {
      if (!game.romId) return null;
      const res = await apiRequest("PATCH", `/api/roms/${game.romId}/play-status`, { playStatus });
      return (await res.json()) as UploadedRom;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
    },
  });
  const createCollection = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/collections", { name });
      return (await res.json()) as GameCollectionWithItems;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
  });
  const toggleCollectionItem = useMutation({
    mutationFn: async ({
      collectionId,
      romId,
      selected,
    }: {
      collectionId: number;
      romId: number;
      selected: boolean;
    }) => {
      const method = selected ? "PUT" : "DELETE";
      const res = await apiRequest(method, `/api/collections/${collectionId}/roms/${romId}`);
      return (await res.json()) as GameCollectionWithItems;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
  });

  const games = useMemo<Game[]>(() => {
    const uploadedGames = uploadedRoms.map(uploadedRomToGame);
    return [...uploadedGames, ...GAMES].map((g) => ({
      ...g,
      favorite: favOverrides[g.id] !== undefined ? favOverrides[g.id] : !!g.favorite,
      rating: ratingOverrides[g.id] !== undefined ? ratingOverrides[g.id] : g.rating,
      playStatus: statusOverrides[g.id] !== undefined ? statusOverrides[g.id] : (g.playStatus ?? "unset"),
    }));
  }, [favOverrides, ratingOverrides, uploadedRoms]);

  // In kiosk mode, auto-filter to the designated collection
  const effectiveFilter = useMemo<Filter>(() => {
    if (kioskMode && kiosk?.collectionId) {
      return `collection:${kiosk.collectionId}` as Filter;
    }
    return filter;
  }, [kioskMode, kiosk, filter]);

  const filtered = useMemo(() => {
    let list = games;
    if (typeof effectiveFilter === "string" && effectiveFilter.startsWith("collection:")) {
      const collectionId = Number(effectiveFilter.replace("collection:", ""));
      const collection = collections.find((item) => item.id === collectionId);
      const romIds = new Set(collection?.romIds ?? []);
      list = list.filter((g) => g.romId && romIds.has(g.romId));
    } else if (effectiveFilter === "favorites") {
      list = list.filter((g) => g.favorite);
    } else if (effectiveFilter === "recent") {
      list = list.filter((g) => g.lastPlayed && g.lastPlayed > 0);
    } else if (effectiveFilter !== "all") {
      list = list.filter((g) => g.system === (effectiveFilter as SystemId));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.genre.toLowerCase().includes(q) ||
          g.system.toLowerCase().includes(q),
      );
    }
    if (genreFilter) {
      list = list.filter((g) => g.genre === genreFilter);
    }
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "year":
          return a.year - b.year;
        case "rating":
          return b.rating - a.rating;
        case "plays":
          return (b.minutesPlayed ?? 0) - (a.minutesPlayed ?? 0);
        case "recent":
        default:
          return (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0);
      }
    });
    return list;
  }, [collections, games, effectiveFilter, filter, query, sort, genreFilter]);

  const availableGenres = useMemo(() => {
    const seen = new Set<string>();
    for (const g of games) {
      if (!g.genre || g.genre === "Uploaded ROM") continue;
      // Apply same filter/query logic but skip genre to get the pool
      const inFilter = (() => {
        if (typeof filter === "string" && filter.startsWith("collection:")) {
          const cid = Number(filter.replace("collection:", ""));
          const col = collections.find((c) => c.id === cid);
          return !!(g.romId && col?.romIds.includes(g.romId));
        }
        if (filter === "favorites") return !!g.favorite;
        if (filter === "recent") return !!(g.lastPlayed && g.lastPlayed > 0);
        if (filter === "all") return true;
        return g.system === filter;
      })();
      if (inFilter) seen.add(g.genre);
    }
    return Array.from(seen).sort();
  }, [games, filter, collections]);

  const recentlyPlayed = useMemo(
    () =>
      [...games]
        .filter((g) => g.lastPlayed)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 6),
    [games],
  );

  const favorites = useMemo(() => games.filter((g) => g.favorite), [games]);
  const systemCounts = useMemo(
    () =>
      Object.fromEntries(
        SYSTEMS.map((system) => [
          system.id,
          games.filter((game) => game.system === system.id).length,
        ]),
      ) as Record<string, number>,
    [games],
  );
  const visibleRecentlyPlayed = useMemo(
    () => {
      if (filter === "favorites") return recentlyPlayed.filter((g) => g.favorite);
      if (typeof filter === "string" && !["all", "recent"].includes(filter) && !filter.startsWith("collection:"))
        return recentlyPlayed.filter((g) => g.system === filter).slice(0, 6);
      return recentlyPlayed;
    },
    [filter, recentlyPlayed],
  );

  const heading = useMemo(() => {
    if (typeof filter === "string" && filter.startsWith("collection:")) {
      const collectionId = Number(filter.replace("collection:", ""));
      return collections.find((collection) => collection.id === collectionId)?.name ?? "Collection";
    }
    if (filter === "favorites") return "Favorites";
    if (filter === "recent") return "Recently Played";
    if (filter === "all") return "All Games";
    return SYSTEMS.find((s) => s.id === filter)?.name ?? "Games";
  }, [collections, filter]);

  const showHero = filter === "favorites" && !query;

  const toggleFav = (g: Game) => {
    const favorite = !g.favorite;
    setFavOverrides((prev) => ({ ...prev, [g.id]: favorite }));
    setOpenGame((cur) => (cur && cur.id === g.id ? { ...cur, favorite } : cur));
    if (g.romId) {
      favoriteUploadedRom.mutate({ game: g, favorite });
    }
  };

  const rateGame = (g: Game, rating: number) => {
    setRatingOverrides((prev) => ({ ...prev, [g.id]: rating }));
    setOpenGame((cur) => (cur && cur.id === g.id ? { ...cur, rating } : cur));
    if (g.romId) {
      rateUploadedRom.mutate({ game: g, rating });
    }
  };

  const setStatus = (g: Game, playStatus: string) => {
    setStatusOverrides((prev) => ({ ...prev, [g.id]: playStatus }));
    setOpenGame((cur) => (cur && cur.id === g.id ? { ...cur, playStatus } : cur));
    if (g.romId) setStatusMutation.mutate({ game: g, playStatus });
  };

  const pickRandom = () => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setOpenGame(pick);
  };

  const handleCreateCollection = () => {
    const name = window.prompt("Name this collection", "RPGs");
    const trimmed = name?.trim();
    if (!trimmed) return;
    createCollection.mutate(trimmed);
  };

  const handleToggleCollection = (collectionId: number, game: Game, selected: boolean) => {
    if (!game.romId) return;
    toggleCollectionItem.mutate({ collectionId, romId: game.romId, selected });
  };

  const isCollectionFilter = typeof filter === "string" && filter.startsWith("collection:");
  const systemFilter = useMemo<SystemId | undefined>(() => {
    if (typeof filter !== "string") return undefined;
    if (filter === "favorites" || filter === "recent" || filter === "all") return undefined;
    if (filter.startsWith("collection:")) return undefined;
    return SYSTEMS.some((s) => s.id === filter) ? (filter as SystemId) : undefined;
  }, [filter]);

  return (
    <div className="flex h-full">
      <WelcomeDialog hasRoms={uploadedRoms.length > 0} />
      <Sidebar active={filter} />

      <main className="flex-1 min-w-0 flex flex-col" data-testid="main-content">
        <MobileTopBar active={filter} />

        {/* Header */}
        <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-border">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Library
              </div>
              <h1
                className="font-display text-xl sm:text-2xl font-bold leading-tight mt-1"
                data-testid="text-heading"
              >
                {heading}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, genre, system…"
                  className="pl-9 font-mono text-sm"
                  data-testid="input-search"
                  aria-label="Search games"
                />
              </div>
              <SortMenu sort={sort} setSort={setSort} />
              <button
                type="button"
                onClick={pickRandom}
                title="Surprise me — pick a random game"
                disabled={filtered.length === 0}
                className="size-9 flex items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground hover-elevate disabled:opacity-40"
                data-testid="button-surprise"
              >
                <Shuffle className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode((v) => v === "grid" ? "list" : "grid")}
                title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                className="size-9 flex items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground hover-elevate"
                data-testid="button-view-toggle"
              >
                {viewMode === "grid" ? <LayoutList className="size-4" /> : <LayoutGrid className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {availableGenres.length > 0 && (
          <div className="px-5 sm:px-8 py-2 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setGenreFilter("")}
              className={`shrink-0 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                !genreFilter
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-genre-all"
            >
              All
            </button>
            {availableGenres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
                className={`shrink-0 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  genreFilter === g
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-genre-${g}`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Hero — Continue Playing */}
          {showHero && pc.online && recentlyPlayed[0] ? (
            <ContinueHero
              game={recentlyPlayed[0]}
              onOpen={setOpenGame}
            />
          ) : null}

          {/* Systems strip */}
          {!kioskMode && (filter === "favorites" || filter === "all") ? (
            <section className="px-5 sm:px-8 pt-5 pb-1">
              <SectionHeading
                title="Browse Systems"
                action={null}
              />
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
                data-testid="grid-systems"
              >
                {SYSTEMS.map((s) => {
                  const count = systemCounts[s.id] ?? 0;
                  return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToFilter(s.id)}
                    className="group relative aspect-[16/10] rounded-lg overflow-hidden border border-card-border hover-elevate active-elevate-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid={`tile-system-${s.id}`}
                  >
                    <SystemTile system={s} />
                    <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-gradient-to-t from-black/75 to-transparent flex items-end justify-between">
                      <div className="font-mono text-[11px] text-white tabular-nums">
                        {count.toLocaleString()}
                        <span className="text-white/60 ml-1">title{count === 1 ? "" : "s"}</span>
                      </div>
                      <ChevronRight className="size-3.5 text-white/70 group-hover:text-white transition" />
                    </div>
                  </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Recently Played strip — only on Favorites/All view, not when filtering by recent itself */}
          {(filter === "favorites" || filter === "all" || (typeof filter === "string" && !filter.startsWith("collection:") && filter !== "recent")) &&
          visibleRecentlyPlayed.length > 0 &&
          !query ? (
            <section className="px-5 sm:px-8 pt-5 pb-1">
              <SectionHeading
                title={filter === "favorites" ? "Recently Played Favorites" : "Recently Played"}
                action={
                  <button
                    type="button"
                    onClick={() => goToFilter("recent")}
                    className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    data-testid="button-see-all-recent"
                  >
                    See all <ChevronRight className="inline size-3" />
                  </button>
                }
              />
              <Grid games={visibleRecentlyPlayed} onOpen={setOpenGame} onToggleFav={toggleFav} />
            </section>
          ) : null}

          {/* Upload — pinned to current system on system pages, or generic with picker on All Games */}
          {!kioskMode && (systemFilter || filter === "all") && !query ? (
            <section className="px-5 sm:px-8 pt-5 pb-1" data-testid="section-rom-upload">
              <RomUpload system={systemFilter} variant="inline" />
            </section>
          ) : null}

          {/* Main grid */}
          <section className="px-5 sm:px-8 pt-5 pb-8">
            <SectionHeading
              title={
                filter === "favorites"
                  ? "Your Favorites"
                  : filter === "all"
                  ? "All Games"
                  : filter === "recent"
                  ? "Recently Played"
                  : isCollectionFilter
                  ? "Collection Games"
                  : `${SYSTEMS.find((s) => s.id === filter)?.shortName} Library`
              }
              action={
                <div className="flex items-center gap-3">
                  {!kioskMode && (
                    <button
                      type="button"
                      onClick={handleCreateCollection}
                      className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      data-testid="button-create-collection"
                    >
                      New collection
                    </button>
                  )}
                  <span
                    className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
                    data-testid="text-result-count"
                  >
                    {filtered.length} title{filtered.length === 1 ? "" : "s"}
                  </span>
                </div>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState query={query} filter={filter} onResetFilter={() => goToFilter("all")} />
            ) : viewMode === "grid" ? (
              <Grid games={filtered} onOpen={setOpenGame} onToggleFav={toggleFav} />
            ) : (
              <ListView games={filtered} onOpen={setOpenGame} onToggleFav={toggleFav} />
            )}
          </section>

          <footer className="px-5 sm:px-8 py-6 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
              <span>
                {favorites.length} favorited · {games.length} uploaded title{games.length === 1 ? "" : "s"}
              </span>
              <span>
                HomeArcade prototype · v0.1 ·{" "}
                <a className="underline-offset-2 hover:underline" href="#/settings">
                  configure HA endpoints →
                </a>
              </span>
            </div>
          </footer>
        </div>
      </main>

      <RightPanel arcadeMode={arcadeMode} onToggleArcade={onToggleArcade} />

      <GameDetailDialog
        game={openGame}
        onClose={() => setOpenGame(null)}
        onToggleFav={(g) => {
          toggleFav(g);
        }}
        onRate={rateGame}
        collections={collections}
        onCreateCollection={handleCreateCollection}
        onToggleCollection={handleToggleCollection}
        onSetStatus={setStatus}
      />
    </div>
  );
}

function Grid({
  games,
  onOpen,
  onToggleFav,
}: {
  games: Game[];
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4"
      data-testid="grid-games"
    >
      {games.map((g) => (
        <GameCard key={g.id} game={g} onOpen={onOpen} onToggleFav={onToggleFav} />
      ))}
    </div>
  );
}


function ListView({
  games,
  onOpen,
  onToggleFav,
}: {
  games: Game[];
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
}) {
  const STATUS_LABELS: Record<string, string> = {
    unset: "", backlog: "Backlog", playing: "Playing", completed: "Completed", dropped: "Dropped",
  };
  const STATUS_COLORS: Record<string, string> = {
    backlog: "text-blue-400", playing: "text-green-400", completed: "text-chart-3", dropped: "text-muted-foreground",
  };
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden" data-testid="list-games">
      {games.map((g) => {
        const system = SYSTEMS.find((s) => s.id === g.system);
        const isNew = g.createdAt && Date.now() - g.createdAt < 7 * 24 * 60 * 60 * 1000;
        return (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(g)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(g); } }}
            className="flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-card/80 cursor-pointer group"
            data-testid={`row-game-${g.id}`}
          >
            {/* Thumbnail */}
            <div className="shrink-0 w-12 h-8 rounded overflow-hidden border border-card-border">
              {g.artUrl ? (
                <img src={g.artUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-[9px] font-bold text-white/60"
                  style={{ background: `linear-gradient(135deg, hsl(${g.art[0]}), hsl(${g.art[1]}))` }}>
                  {system?.monogram ?? g.system.slice(0, 3).toUpperCase()}
                </div>
              )}
            </div>
            {/* Title + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">{g.title}</span>
                {isNew && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                    New
                  </span>
                )}
                {g.playStatus && g.playStatus !== "unset" && (
                  <span className={`shrink-0 font-mono text-[10px] ${STATUS_COLORS[g.playStatus] ?? "text-muted-foreground"}`}>
                    · {STATUS_LABELS[g.playStatus]}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                {system?.shortName ?? g.system}{g.genre && g.genre !== "Uploaded ROM" ? ` · ${g.genre}` : ""}
                {(g.minutesPlayed ?? 0) > 0 ? ` · ${g.minutesPlayed}m played` : ""}
              </div>
            </div>
            {/* Rating + fav */}
            <div className="shrink-0 flex items-center gap-3">
              {g.rating > 0 && (
                <div className="flex items-center gap-0.5 font-mono text-[11px] text-chart-3">
                  {"★".repeat(g.rating)}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleFav(g); }}
                className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary focus:outline-none"
                aria-label={g.favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <span className={g.favorite ? "text-primary" : ""}>♥</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action: React.ReactNode | null;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-base sm:text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {action}
    </div>
  );
}

function SortMenu({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const options: { id: Sort; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "title", label: "A–Z" },
    { id: "year", label: "Year" },
    { id: "rating", label: "Rating" },
    { id: "plays", label: "Plays" },
  ];
  return (
    <div
      className="hidden sm:flex items-center gap-1 rounded-md border border-border bg-background/40 p-1"
      data-testid="group-sort"
      role="radiogroup"
      aria-label="Sort games"
    >
      <SlidersHorizontal className="size-3.5 text-muted-foreground ml-1.5 mr-0.5" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={sort === o.id}
          onClick={() => setSort(o.id)}
          className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase tracking-wider hover-elevate ${
            sort === o.id ? "bg-secondary text-foreground" : "text-muted-foreground"
          }`}
          data-testid={`button-sort-${o.id}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  query,
  filter,
  onResetFilter,
}: {
  query: string;
  filter: Filter;
  onResetFilter: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center"
      data-testid="state-empty"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        No matches
      </div>
      <p className="mt-2 font-display text-base text-foreground">
        {query
          ? `No games match “${query}”.`
          : filter === "favorites"
          ? "You have no favorites yet."
          : "No games in this view."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
        Add favorites by tapping the heart on any game card, or browse all titles.
      </p>
      <Button variant="outline" className="mt-4" onClick={onResetFilter} data-testid="button-empty-reset">
        Browse all games
      </Button>
    </div>
  );
}

function ContinueHero({
  game,
  onOpen,
}: {
  game: Game;
  onOpen: (g: Game) => void;
}) {
  const launch = () => {
    if (game.romId) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
    } else {
      onOpen(game);
    }
  };

  return (
    <section className="px-5 sm:px-8 pt-5">
      <div
        className="relative rounded-xl overflow-hidden border border-card-border min-h-[168px] sm:min-h-[188px]"
        data-testid="hero-continue"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, hsl(${game.art[0]}) 0%, hsl(${game.art[1]}) 60%, hsl(${game.art[2]}) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.1)_100%)]" />
        <div className="relative p-5 sm:p-7 flex flex-col gap-2.5 max-w-xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/80">
            Continue Playing
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
            {game.title}
          </h2>
          <p className="text-sm text-white/80 max-w-sm">
            Pick up where you left off — your save state loads automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Button
              size="lg"
              onClick={launch}
              className="font-mono uppercase tracking-wider ring-neon"
              data-testid="button-hero-launch"
            >
              Play
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpen(game)}
              className="bg-black/70 border-white/35 text-white hover:bg-black/85 shadow-sm"
              data-testid="button-hero-details"
            >
              Details
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
