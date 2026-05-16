import React, { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { SYSTEMS, type SystemId, GAMES } from "@/data/library";
import type { GameCollectionWithItems, UploadedRom } from "@shared/schema";
import { Wordmark } from "@/components/Logo";
import { useQuery } from "@tanstack/react-query";
import { filterToPath } from "@/lib/filter";
import {
  LayoutDashboard,
  Heart,
  Clock,
  LayoutGrid,
  BookMarked,
  Gamepad2,
  CheckCircle2,
  Settings as SettingsIcon,
  Trophy,
  Folder,
  History,
  ChevronsUpDown,
  Radio,
  PanelLeft,
} from "lucide-react";
import { useProfile } from "@/lib/useProfile";
import type { UserProfile } from "@shared/schema";
import { useTranslation } from "react-i18next";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export type Filter = SystemId | `collection:${number}` | "all" | "favorites" | "recent" | "backlog" | "completed";

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  
  // Derive active filter from location
  const active = useMemo(() => {
    if (location === "/") return "dashboard";
    if (location.startsWith("/settings")) return "settings";
    if (location.startsWith("/history")) return "history";
    if (location.startsWith("/achievements")) return "achievements";
    
    if (location.startsWith("/library/collection/")) {
      const id = location.split("/").pop();
      return `collection:${id}`;
    }
    if (location.startsWith("/library/")) {
      return location.split("/").pop() as Filter;
    }
    return null;
  }, [location]);

  const { data: kiosk } = useQuery<{ enabled: boolean }>({ queryKey: ["/api/kiosk"] });
  const kioskMode = !!kiosk?.enabled;
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({ queryKey: ["/api/collections"] });
  const { state, isMobile } = useSidebar();

  const favCount      = GAMES.filter((g) => g.favorite).length + uploadedRoms.filter((r) => r.favorite).length;
  const recentCount   = GAMES.filter((g) => g.lastPlayed && g.lastPlayed > 0).length + uploadedRoms.filter((r) => r.lastPlayed && r.lastPlayed > 0).length;
  const allCount      = GAMES.length + uploadedRoms.length;
  const backlogCount  = uploadedRoms.filter((r) => r.playStatus === "backlog").length;
  const playingCount  = uploadedRoms.filter((r) => r.playStatus === "playing").length;
  const completedCount= uploadedRoms.filter((r) => r.playStatus === "completed").length;
  
  const systemCounts  = Object.fromEntries(
    SYSTEMS.map((system) => [
      system.id,
      GAMES.filter((g) => g.system === system.id).length + uploadedRoms.filter((r) => r.system === system.id).length,
    ]),
  ) as Record<string, number>;

  const { data: nowPlaying } = useQuery<{ playing: boolean; id?: number; title?: string; system?: string }>({
    queryKey: ["/api/now-playing"],
    queryFn: async () => { const res = await fetch("/api/now-playing"); return res.json(); },
    refetchInterval: (query) => {
      if (document.hidden) return false;
      return query.state.data?.playing ? 5000 : 15000;
    },
    staleTime: 5000,
  });

  return (
    <ShadcnSidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <SidebarHeader className="h-16 flex items-center justify-between px-4">
        {state === "expanded" && (
          <Link href="/" className="flex-1 outline-none">
            <Wordmark />
          </Link>
        )}
        <SidebarTrigger className={state === "collapsed" ? "mx-auto" : "ml-auto"} />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="nav-scroll">
        {/* Now Playing indicator */}
        {nowPlaying?.playing && nowPlaying.title && (
          <SidebarGroup>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={`${t("dashboard.liveNow")}: ${nowPlaying.title}`}
                className="bg-primary/10 text-primary border border-primary/20 rounded-xl mx-1 h-10"
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                {state === "expanded" && <span className="truncate font-medium text-xs ml-2">{nowPlaying.title}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarGroup>
        )}

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={active === "dashboard"}
                tooltip={t("nav.dashboard")}
              >
                <Link href="/">
                  <LayoutDashboard className="size-4" />
                  <span>{t("nav.dashboard")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Library */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("home.sections.library")}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "favorites"} tooltip={t("home.sections.favorites")}>
                <Link href={filterToPath("favorites")}>
                  <Heart className="size-4" />
                  <span>{t("home.sections.favorites")}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuBadge>{favCount}</SidebarMenuBadge>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "recent"} tooltip={t("home.sections.recentlyPlayed")}>
                <Link href={filterToPath("recent")}>
                  <Clock className="size-4" />
                  <span>{t("home.sections.recentlyPlayed")}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuBadge>{recentCount}</SidebarMenuBadge>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "all"} tooltip={t("home.sections.allGames")}>
                <Link href={filterToPath("all")}>
                  <LayoutGrid className="size-4" />
                  <span>{t("home.sections.allGames")}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuBadge>{allCount}</SidebarMenuBadge>
            </SidebarMenuItem>

            {backlogCount > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={active === "backlog"} tooltip={t("dashboard.status.backlog")}>
                  <Link href={filterToPath("backlog" as any)}>
                    <BookMarked className="size-4" />
                    <span>{t("dashboard.status.backlog")}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuBadge>{backlogCount}</SidebarMenuBadge>
              </SidebarMenuItem>
            )}

            {completedCount > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={active === "completed"} tooltip={t("dashboard.status.completed")}>
                  <Link href={filterToPath("completed" as any)}>
                    <CheckCircle2 className="size-4" />
                    <span>{t("dashboard.status.completed")}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuBadge>{completedCount}</SidebarMenuBadge>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Systems */}
        {!kioskMode && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("dashboard.sections.browseSystems")}</SidebarGroupLabel>
            <SidebarMenu>
              {SYSTEMS.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={active === s.id}
                    tooltip={s.shortName}
                  >
                    <Link href={filterToPath(s.id)}>
                      <span
                        className="inline-block size-3 rounded-sm shrink-0"
                        style={{ background: `linear-gradient(135deg, hsl(${s.art[0]}), hsl(${s.art[1]}))` }}
                      />
                      <span>{s.shortName}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{systemCounts[s.id] ?? 0}</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.collections") || "Collections"}</SidebarGroupLabel>
            <SidebarMenu>
              {collections.map((collection) => (
                <SidebarMenuItem key={collection.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={active === `collection:${collection.id}`}
                    tooltip={collection.name}
                  >
                    <Link href={filterToPath(`collection:${collection.id}` as any)}>
                      <Folder className="size-4" />
                      <span>{collection.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{collection.romIds.length}</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar/40 p-2">
        {!kioskMode && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "history"} tooltip={t("history.title")}>
                <Link href="/history">
                  <History className="size-4" />
                  <span>{t("history.title")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "achievements"} tooltip={t("achievements.title")}>
                <Link href="/achievements">
                  <Trophy className="size-4" />
                  <span>{t("achievements.title")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === "settings"} tooltip={t("settings.title")}>
                <Link href="/settings">
                  <SettingsIcon className="size-4" />
                  <span>{t("settings.title")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarProfile />
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  );
}

/* ── Profile Switcher ── */
function SidebarProfile() {
  const { currentProfileId, setCurrentProfileId } = useProfile();
  const [open, setOpen] = useState(false);
  const { data: profiles = [] } = useQuery<UserProfile[]>({ queryKey: ["/api/profiles"] });
  const active = profiles.find((p) => p.id === currentProfileId);
  const { state } = useSidebar();

  if (!active || profiles.length <= 1) return null;

  return (
    <div className="relative mt-1">
      {open && state === "expanded" && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-sidebar-border bg-sidebar shadow-2xl py-1 z-50 overflow-hidden">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setCurrentProfileId(p.id);
                setOpen(false);
              }}
              className={[
                "w-full flex items-center gap-3 px-3 h-10 text-left transition-colors text-xs",
                p.id === currentProfileId
                  ? "bg-primary-container/60 text-foreground"
                  : "text-sidebar-foreground/70 hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="flex-1 truncate font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <SidebarMenuButton
        onClick={() => setOpen((o) => !o)}
        tooltip={active.name}
        className="h-10"
      >
        <span className="size-2.5 rounded-full shrink-0" style={{ background: active.color }} />
        <span className="flex-1 truncate text-left font-medium text-xs">{active.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/50" />
      </SidebarMenuButton>
    </div>
  );
}
