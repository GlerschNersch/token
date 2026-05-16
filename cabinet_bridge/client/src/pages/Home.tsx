import React, { useMemo, useRef, useState, useEffect, memo, useCallback } from "react";
import { useLocation } from "wouter";
import Fuse from "fuse.js";
import { type Filter } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { GameCard, GameCardSkeleton } from "@/components/GameCard";
import { GameDetailDialog } from "@/components/GameDetailDialog";
import { SystemTile } from "@/components/GameArt";
import { RomUpload } from "@/components/RomUpload";
import { GAMES, SYSTEMS, type Game, type SystemId, uploadedRomToGame } from "@/data/library";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronRight,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Shuffle,
  X,
  Check,
  Play,
} from "lucide-react";
import { useProfile } from "@/lib/useProfile";
import { useIntegration } from "@/lib/integration";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { filterToPath } from "@/lib/filter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { GameCollectionWithItems, UploadedRom, ProfileGameState } from "@shared/schema";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { SurpriseWheel } from "@/components/SurpriseWheel";
import { useGridNav } from "@/lib/useGridNav";
import { formatRelative } from "@/lib/integration";
import { useTranslation } from "react-i18next";

type Sort = "title" | "year" | "recent" | "rating" | "plays";

export default function Home({ filter }: { filter: Filter }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const goToFilter = (next: Filter) => navigate(filterToPath(next));

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("ha-sort") as Sort | null) ?? "recent");
  const [genreFilter, setGenreFilter] = useState<string>(() => localStorage.getItem("ha-genre") ?? "");
  const [openGame, setOpenGame] = useState<Game | null>(null);
  const [showSurpriseWheel, setShowSurpriseWheel] = useState(false);
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const [ratingOverrides, setRatingOverrides] = useState<Record<string, number>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const persistSort = (s: Sort) => { setSort(s); try { localStorage.setItem("ha-sort", s); } catch {} };
  const persistGenre = (g: string) => { setGenreFilter(g); try { localStorage.setItem("ha-genre", g); } catch {} };
  const [newCollectionName, setNewCollectionName] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { currentProfileId } = useProfile();

  // "/" or Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { pc, config } = useIntegration();

  const { data: uploadedRoms = [], isLoading: romsLoading } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });
  const { data: profileGameStates = [] } = useQuery<ProfileGameState[]>({
    queryKey: ["/api/profiles", currentProfileId, "game-states"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/profiles/${currentProfileId}/game-states`));
      if (!res.ok) return [];
      return res.json();
    },
    enabled: currentProfileId > 0,
  });

  const profileStateMap = useMemo(() => {
    const m = new Map<number, ProfileGameState>();
    for (const s of profileGameStates) m.set(s.romId, s);
    return m;
  }, [profileGameStates]);

  const { data: kiosk } = useQuery<{
    enabled: boolean;
    collectionId: number | null;
    hasPin: boolean;
  }>({ queryKey: ["/api/kiosk"] });

  const kioskMode = !!kiosk?.enabled;

  const rateUploadedRom = useMutation({
    mutationFn: async ({ game, rating }: { game: Game; rating: number }) => {
      if (!game.romId) return null;
      if (currentProfileId !== 1) {
        await apiRequest("PATCH", `/api/profiles/${currentProfileId}/game-states/${game.romId}`, { rating });
      } else {
        await apiRequest("PATCH", `/api/roms/${game.romId}/rating`, { rating });
      }
      return rating;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles", currentProfileId, "game-states"] });
    },
  });

  const favoriteUploadedRom = useMutation({
    mutationFn: async ({ game, favorite }: { game: Game; favorite: boolean }) => {
      if (!game.romId) return null;
      if (currentProfileId !== 1) {
        await apiRequest("PATCH", `/api/profiles/${currentProfileId}/game-states/${game.romId}`, { favorite });
      } else {
        await apiRequest("PATCH", `/api/roms/${game.romId}/favorite`, { favorite });
      }
      return favorite;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles", currentProfileId, "game-states"] });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ game, playStatus }: { game: Game; playStatus: string }) => {
      if (!game.romId) return null;
      if (currentProfileId !== 1) {
        await apiRequest("PATCH", `/api/profiles/${currentProfileId}/game-states/${game.romId}`, { playStatus });
      } else {
        await apiRequest("PATCH", `/api/roms/${game.romId}/play-status`, { playStatus });
      }
      return playStatus;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles", currentProfileId, "game-states"] });
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

  const games = useMemo<Game[]>(
    () => {
      if (!uploadedRoms.length && !GAMES.length) return [];

      const uploadedGames = uploadedRoms.map(uploadedRomToGame);
      const allGames = [...uploadedGames, ...GAMES].map((g) => {
        const profileState = g.romId ? profileStateMap.get(g.romId) : undefined;
        return {
          ...g,
          favorite:
            favOverrides[g.id] !== undefined ? favOverrides[g.id] :
            (profileState?.favorite !== undefined && currentProfileId !== 1
              ? !!profileState.favorite
              : !!g.favorite),
          rating:
            ratingOverrides[g.id] !== undefined ? ratingOverrides[g.id] :
            (profileState?.rating !== undefined && currentProfileId !== 1
              ? profileState.rating!
              : g.rating),
          playStatus:
            statusOverrides[g.id] !== undefined ? statusOverrides[g.id] :
            (profileState?.playStatus !== undefined && currentProfileId !== 1
              ? profileState.playStatus!
              : (g.playStatus ?? "unset")),
        };
      });

      const groups: Record<string, Game[]> = {};
      const singletons: Game[] = [];
      for (const g of allGames) {
        if (g.discGroup) {
          const groupKey = `${g.system}:${g.discGroup}`;
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(g);
        } else {
          singletons.push(g);
        }
      }

      const merged: Game[] = [...singletons];
      for (const discs of Object.values(groups)) {
        discs.sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1));
        const latest = [...discs].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0];
        const primary = {
          ...discs[0],
          lastPlayed: latest.lastPlayed,
          playCount: discs.reduce((sum, d) => sum + (d.playCount ?? 0), 0),
          minutesPlayed: discs.reduce((sum, d) => sum + (d.minutesPlayed ?? 0), 0),
          discIds: discs.map(d => d.romId).filter(Boolean) as number[],
          isMultiDisc: true,
        };
        merged.push(primary);
      }
      return merged;
    },
    [favOverrides, ratingOverrides, statusOverrides, uploadedRoms, profileStateMap, currentProfileId],
  );

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
      const sys = SYSTEMS.find(s => s.id === effectiveFilter || s.slug === effectiveFilter);
      const targetId = sys?.id || effectiveFilter;
      list = list.filter((g) => g.system === targetId || g.system === effectiveFilter);
    }

    if (query.trim()) {
      const fuse = new Fuse(games, {
        keys: ["title", "genre", "system", "developer", "publisher"],
        threshold: 0.35,
        distance: 100,
      });
      list = fuse.search(query.trim()).map((r) => r.item);
    }

    if (genreFilter) {
      list = list.filter((g) => g.genre === genreFilter);
    }

    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "year":
          return (a.year || 0) - (b.year || 0);
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "plays":
          return (b.minutesPlayed ?? 0) - (a.minutesPlayed ?? 0);
        case "recent":
        default:
          return (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0);
      }
    });

    return sorted;
  }, [collections, games, effectiveFilter, query, sort, genreFilter]);

  const availableGenres = useMemo(() => {
    const seen = new Set<string>();
    for (const g of games) {
      if (!g.genre || g.genre === "Uploaded ROM") continue;
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

  const visibleRecentlyPlayed = useMemo(() => {
    if (filter === "favorites") return recentlyPlayed.filter((g) => g.favorite);
    if (
      typeof filter === "string" &&
      !["all", "recent"].includes(filter) &&
      !filter.startsWith("collection:")
    )
      return recentlyPlayed.filter((g) => g.system === filter).slice(0, 6);
    return recentlyPlayed;
  }, [filter, recentlyPlayed]);

  const heading = useMemo(() => {
    if (typeof filter === "string" && filter.startsWith("collection:")) {
      const collectionId = Number(filter.replace("collection:", ""));
      return collections.find((collection) => collection.id === collectionId)?.name ?? t("home.sections.collectionGames");
    }
    if (filter === "favorites") return t("home.sections.favorites");
    if (filter === "recent") return t("home.sections.recentlyPlayed");
    if (filter === "all") return t("home.sections.allGames");
    return SYSTEMS.find((s) => s.id === filter)?.name ?? t("home.sections.library");
  }, [collections, filter, t]);

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

  const handleCreateCollection = () => setNewCollectionName("");

  const submitNewCollection = () => {
    const trimmed = newCollectionName?.trim();
    if (!trimmed) { setNewCollectionName(null); return; }
    createCollection.mutate(trimmed, { onSuccess: () => setNewCollectionName(null) });
  };

  const handleToggleCollection = (collectionId: number, game: Game, selected: boolean) => {
    if (!game.romId) return;
    toggleCollectionItem.mutate({ collectionId, romId: game.romId, selected });
  };

  const isCollectionFilter =
    typeof filter === "string" && filter.startsWith("collection:");

  const systemFilter = useMemo<SystemId | undefined>(() => {
    if (typeof filter !== "string") return undefined;
    if (filter === "favorites" || filter === "recent" || filter === "all") return undefined;
    if (filter.startsWith("collection:")) return undefined;
    return SYSTEMS.some((s) => s.id === filter) ? (filter as SystemId) : undefined;
  }, [filter]);

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden" data-testid="main-content">
      <WelcomeDialog hasRoms={uploadedRoms.length > 0} />
      <MobileTopBar />

      {/* ── Header ── */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-border">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("home.sections.library")}
            </div>
            <h1
              className="font-display text-xl sm:text-2xl font-bold leading-tight mt-1"
              data-testid="text-heading"
            >
              {heading}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-72">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.search")}
                className="pl-9 pr-8 font-mono text-sm"
                ref={searchRef}
                data-testid="input-search"
                aria-label="Search games"
                onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); searchRef.current?.blur(); } }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <SortMenu sort={sort} setSort={persistSort} />

            <button
              type="button"
              onClick={() => setShowSurpriseWheel(true)}
              title={t("home.actions.surprise")}
              disabled={filtered.length === 0}
              className="size-9 flex items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground hover-elevate disabled:opacity-40"
              data-testid="button-surprise"
            >
              <Shuffle className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
              title={viewMode === "grid" ? t("home.view.list") : t("home.view.grid")}
              className="size-9 flex items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground hover-elevate"
              data-testid="button-view-toggle"
            >
              {viewMode === "grid" ? (
                <LayoutList className="size-4" />
              ) : (
                <LayoutGrid className="size-4" />
              )}
            </button>

          </div>
        </div>
      </div>

      {/* ── Search scope notice ── */}
      {query.trim() && (
        <div className="px-4 sm:px-8 py-1.5 border-b border-border flex items-center gap-2 bg-primary/5">
          <Search className="size-3 text-primary/60 shrink-0" />
          <span className="font-mono text-[10px] text-muted-foreground flex-1">
            {t("home.status.searchingScope", { total: games.length })}
            <span className="text-foreground font-semibold">{t("home.status.results", { count: filtered.length })}</span>
          </span>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {t("home.status.clear")}
          </button>
        </div>
      )}

      {/* ── Mobile sort bar ── */}
      <div
        className="sm:hidden flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto scrollbar-none"
        data-testid="group-sort-mobile"
        role="radiogroup"
        aria-label="Sort games"
      >
        <SlidersHorizontal className="size-3.5 text-muted-foreground shrink-0" />
        {[
          { id: "recent", label: t("home.sort.recent") },
          { id: "title", label: t("home.sort.az") },
          { id: "year", label: t("home.sort.year") },
          { id: "rating", label: t("home.sort.rating") },
          { id: "plays", label: t("home.sort.plays") },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sort === o.id}
            onClick={() => persistSort(o.id as Sort)}
            className={`shrink-0 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
              sort === o.id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-sort-mobile-${o.id}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Genre filter bar ── */}
      {availableGenres.length > 0 && (
        <div className="px-4 sm:px-8 py-2 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => persistGenre("")}
            className={`shrink-0 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
              !genreFilter
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-genre-all"
          >
            {t("common.ui.all")}
          </button>
          {availableGenres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => persistGenre(genreFilter === g ? "" : g)}
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

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto pb-20 lg:pb-0 overscroll-y-contain scroll-smooth">
        {showHero && pc.online && recentlyPlayed[0] ? (
          <ContinueHero game={recentlyPlayed[0]} onOpen={setOpenGame} profileId={currentProfileId} />
        ) : null}

        {recentlyPlayed.length > 0 && (filter === "favorites" || filter === "all") && !query && (
          <section className="px-4 sm:px-8 pt-5 pb-1">
            <SectionHeading title={t("home.sections.jumpBackIn")} action={null} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recentlyPlayed.slice(0, 6).map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  showSaveThumb={true}
                  onOpen={setOpenGame}
                  onToggleFav={toggleFav}
                  priority={true}
                />
              ))}
            </div>
          </section>
        )}

        {(filter === "favorites" || filter === "all") && !query ? (
          <section className="px-4 sm:px-8 pt-5 pb-1">
            <SectionHeading
              title={t("home.sections.browseSystems")}
              action={
                <button
                  type="button"
                  onClick={() => goToFilter("all")}
                  className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  data-testid="button-see-all-systems"
                >
                  {t("common.ui.seeAll")} <ChevronRight className="inline size-3" />
                </button>
              }
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
                        {t("dashboard.stats.gamesCount", { count })}
                      </div>
                      <ChevronRight className="size-3.5 text-white/70 group-hover:text-white transition" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {(filter === "favorites" ||
          filter === "all" ||
          (typeof filter === "string" &&
            !filter.startsWith("collection:") &&
            filter !== "recent")) &&
        visibleRecentlyPlayed.length > 0 &&
        !query ? (
          <section className="px-4 sm:px-8 pt-5 pb-1">
            <SectionHeading
              title={filter === "favorites" ? t("home.sections.favoritesRecentlyPlayed") : t("home.sections.recentlyPlayed")}
              action={
                <button
                  type="button"
                  onClick={() => goToFilter("recent")}
                  className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  data-testid="button-see-all-recent"
                >
                  {t("common.ui.seeAll")} <ChevronRight className="inline size-3" />
                </button>
              }
            />
            <Grid games={visibleRecentlyPlayed} onOpen={setOpenGame} onToggleFav={toggleFav} mapping={config.uiGamepadMapping} />
          </section>
        ) : null}

        {!kioskMode && (systemFilter || filter === "all") && !query ? (
          <section className="px-4 sm:px-8 pt-5 pb-1" data-testid="section-rom-upload">
            <RomUpload system={systemFilter} variant="inline" />
          </section>
        ) : null}

        <section className="px-4 sm:px-8 pt-5 pb-8">
          <SectionHeading
            title={
              filter === "favorites"
                ? t("home.sections.favorites")
                : filter === "all"
                  ? t("home.sections.allGames")
                  : filter === "recent"
                    ? t("home.sections.recentlyPlayed")
                    : isCollectionFilter
                      ? t("home.sections.collectionGames")
                      : t("home.sections.systemLibrary", { system: SYSTEMS.find((s) => s.id === filter)?.shortName })
            }
            action={
              <div className="flex items-center gap-3">
                {!kioskMode && (
                  newCollectionName !== null ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitNewCollection();
                          if (e.key === "Escape") setNewCollectionName(null);
                        }}
                        placeholder={t("home.prompts.collectionName")}
                        className="h-6 w-32 rounded border border-border bg-background/70 px-2 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="input-new-collection"
                      />
                      <button type="button" onClick={submitNewCollection}
                        className="text-muted-foreground hover:text-foreground" data-testid="button-save-collection">
                        <Check className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setNewCollectionName(null)}
                        className="text-muted-foreground hover:text-foreground" data-testid="button-cancel-collection">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateCollection}
                      className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      data-testid="button-create-collection"
                    >
                      {t("home.actions.newCollection")}
                    </button>
                  )
                )}
                <span
                  className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
                  data-testid="text-result-count"
                >
                  {t("home.status.results", { count: filtered.length })}
                </span>
              </div>
            }
          />
          {romsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {Array.from({ length: 12 }).map((_, i) => <GameCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              query={query}
              filter={filter}
              onResetFilter={() => goToFilter("all")}
            />
          ) : viewMode === "grid" ? (
          <Grid
            games={filtered}
            onOpen={setOpenGame}
            onToggleFav={toggleFav}
            disabled={openGame !== null}
            mapping={config.uiGamepadMapping}
          />
        ) : (
          <ListView
            games={filtered}
            onOpen={setOpenGame}
            onToggleFav={toggleFav}
          />
        )}
        </section>

        <footer className="px-4 sm:px-8 py-6 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
            <span>
              {t("home.status.summary", { favorites: favorites.length, uploaded: games.length })}
            </span>
            <span>
              HomeArcade ·{" "}
              <a className="underline-offset-2 hover:underline" href="#/settings">
                {t("nav.settings")} →
              </a>
            </span>
          </div>
        </footer>
      </div>

      <GameDetailDialog
        game={openGame}
        onClose={() => setOpenGame(null)}
        onToggleFav={(g) => toggleFav(g)}
        onRate={rateGame}
        collections={collections}
        onCreateCollection={handleCreateCollection}
        onToggleCollection={handleToggleCollection}
        onSetStatus={setStatus}
        profileId={currentProfileId}
      />

      <SurpriseWheel
        open={showSurpriseWheel}
        onClose={() => setShowSurpriseWheel(false)}
        games={filtered}
        onLaunch={(g) => {
          setShowSurpriseWheel(false);
          const returnTo = encodeURIComponent(window.location.href);
          window.location.href = apiUrl(`/api/roms/${g.romId}/player?return=${returnTo}&profile=${currentProfileId}`);
        }}
        onOpenDetails={(g) => {
          setShowSurpriseWheel(false);
          setOpenGame(g);
        }}
      />
    </div>
  );
}

const Grid = memo(function Grid({
  games,
  onOpen,
  onToggleFav,
  disabled,
  mapping,
}: {
  games: Game[];
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
  disabled?: boolean;
  mapping?: { select?: number; favorite?: number };
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { focusedIndex } = useGridNav({
    count: games.length,
    gridRef,
    disabled,
    onActivate: (i) => { if (games[i]) onOpen(games[i]); },
    onFav: (i) => { if (games[i]) onToggleFav(games[i]); },
    mapping,
  });

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4"
      data-testid="grid-games"
    >
      {games.map((g, i) => (
        <GameCard key={g.id} game={g} onOpen={onOpen} onToggleFav={onToggleFav} focused={i === focusedIndex} priority={i < 10} />
      ))}
    </div>
  );
});

const ListView = memo(function ListView({
  games,
  onOpen,
  onToggleFav,
}: {
  games: Game[];
  onOpen: (g: Game) => void;
  onToggleFav: (g: Game) => void;
}) {
  const { t } = useTranslation();
  const STATUS_LABELS: Record<string, string> = {
    unset: "",
    backlog: t("dashboard.status.backlog"),
    playing: t("dashboard.status.playing"),
    completed: t("dashboard.status.completed"),
    dropped: t("dashboard.status.dropped"),
  };
  const STATUS_COLORS: Record<string, string> = {
    backlog: "text-blue-400",
    playing: "text-green-400",
    completed: "text-chart-3",
    dropped: "text-muted-foreground",
  };

  return (
    <div
      className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden"
      data-testid="list-games"
    >
      {games.map((g) => {
        const system = SYSTEMS.find((s) => s.id === g.system);
        const isNew = g.createdAt && Date.now() - g.createdAt < 7 * 24 * 60 * 60 * 1000;

        return (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(g)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(g);
              }
            }}
            className="flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-card/80 cursor-pointer group"
            data-testid={`row-game-${g.id}`}
          >
            <div className="shrink-0 w-12 h-8 rounded overflow-hidden border border-card-border">
              {g.artUrl ? (
                <img src={g.artUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-mono text-[9px] font-bold text-white/60"
                  style={{
                    background: `linear-gradient(135deg, hsl(${g.art[0]}), hsl(${g.art[1]}))`,
                  }}
                >
                  {system?.mono ?? g.system.slice(0, 3).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">{g.title}</span>
                {isNew && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                    {t("common.ui.new")}
                  </span>
                )}
                {g.playStatus && g.playStatus !== "unset" && (
                  <span
                    className={`shrink-0 font-mono text-[10px] ${STATUS_COLORS[g.playStatus] ?? "text-muted-foreground"}`}
                  >
                    · {STATUS_LABELS[g.playStatus]}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                {system?.shortName ?? g.system}
                {g.genre && g.genre !== "Uploaded ROM" ? ` · ${g.genre}` : ""}
                {(g.minutesPlayed ?? 0) > 0 ? ` · ${g.minutesPlayed}m ${t("common.played")}` : ""}
              </div>
              {g.description && (
                <div className="text-[11px] text-foreground/50 mt-0.5 truncate leading-tight">
                  {g.description}
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-3">
              {g.rating > 0 && (
                <div className="flex items-center gap-0.5 font-mono text-[11px] text-chart-3">
                  {"★".repeat(g.rating)}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFav(g);
                }}
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
});

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action: React.ReactNode | null;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-base sm:text-lg font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function SortMenu({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const { t } = useTranslation();
  const options = [
    { id: "recent", label: t("home.sort.recent") },
    { id: "title", label: t("home.sort.az") },
    { id: "year", label: t("home.sort.year") },
    { id: "rating", label: t("home.sort.rating") },
    { id: "plays", label: t("home.sort.plays") },
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
          onClick={() => setSort(o.id as Sort)}
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
  const { t } = useTranslation();
  return (
    <div
      className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center"
      data-testid="state-empty"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("home.status.noMatches")}
      </div>
      <p className="mt-2 font-display text-base text-foreground">
        {query
          ? t("home.status.noMatchesDetail", { query })
          : filter === "favorites"
            ? t("home.status.noFavorites")
            : t("home.status.noGames")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
        {filter === "favorites" ? t("home.status.noFavoritesDetail") : ""}
      </p>
      <Button variant="outline" className="mt-4" onClick={onResetFilter} data-testid="button-empty-reset">
        {t("home.status.browseAll")}
      </Button>
    </div>
  );
}

function ContinueHero({ game, onOpen, profileId = 1 }: { game: Game; onOpen: (g: Game) => void; profileId?: number }) {
  const { t } = useTranslation();
  const launch = () => {
    if (game.romId) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}&profile=${profileId}`);
    } else {
      onOpen(game);
    }
  };

  return (
    <section className="px-4 sm:px-8 pt-5">
      <div
        className="relative rounded-xl overflow-hidden border border-card-border min-h-[168px] landscape:min-h-[130px] sm:min-h-[188px] transition-[height] duration-300 ease-in-out"
        data-testid="hero-continue"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, hsl(${game.art[0]}) 0%, hsl(${game.art[1]}) 60%, hsl(${game.art[2]}) 100%)`,
          }}
        />
        {game.artUrl && (
          <img
            src={game.artUrl}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.1)_100%)]" />
        <div className="relative p-5 sm:p-7 flex flex-col gap-2.5 max-w-xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/80">
            {t("home.sections.continuePlaying")}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
            {game.title}
          </h2>
          <p className="text-sm text-white/80 max-w-sm">
            {t("home.status.continueHeroDetail")}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Button
              size="lg"
              onClick={launch}
              className="font-mono uppercase tracking-wider ring-neon"
              data-testid="button-hero-launch"
            >
              <Play className="size-4 fill-current" />
              {t("common.ui.play")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onOpen(game)}
              className="bg-black/70 border-white/35 text-white hover:bg-black/85 shadow-sm"
              data-testid="button-hero-details"
            >
              {t("common.ui.details")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
