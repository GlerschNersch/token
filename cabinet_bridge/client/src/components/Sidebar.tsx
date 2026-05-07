import { Link, useLocation } from "wouter";
import { SYSTEMS, type SystemId, GAMES } from "@/data/library";
import type { GameCollectionWithItems, UploadedRom } from "@shared/schema";
import { Wordmark } from "@/components/Logo";
import { useQuery } from "@tanstack/react-query";
import { filterToPath } from "@/lib/filter";
import {
  Heart,
  Clock,
  LayoutGrid,
  BookMarked,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Settings as SettingsIcon,
  Trophy,
  Folder,
} from "lucide-react";

export type Filter = SystemId | `collection:${number}`;

interface SidebarProps {
  active: Filter;
  /** When true, never hidden on mobile — used inside the mobile sheet. */
  alwaysVisible?: boolean;
  /** Fired after a sidebar nav item is selected. Mobile drawer closes via this. */
  onNavigate?: () => void;
}

export function Sidebar({ active, alwaysVisible = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const onSettingsRoute = location.startsWith("/settings");
  const { data: kiosk } = useQuery<{ enabled: boolean }>({ queryKey: ["/api/kiosk"] });
  const kioskMode = !!kiosk?.enabled;
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const favCount = GAMES.filter((g) => g.favorite).length + uploadedRoms.filter((r) => r.favorite).length;
  const recentCount =
    GAMES.filter((g) => g.lastPlayed && g.lastPlayed > 0).length +
    uploadedRoms.filter((r) => r.lastPlayed && r.lastPlayed > 0).length;
  const allCount = GAMES.length + uploadedRoms.length;
  const backlogCount = uploadedRoms.filter((r) => r.playStatus === "backlog").length;
  const playingCount = uploadedRoms.filter((r) => r.playStatus === "playing").length;
  const completedCount = uploadedRoms.filter((r) => r.playStatus === "completed").length;
  const systemCounts = Object.fromEntries(
    SYSTEMS.map((system) => [
      system.id,
      GAMES.filter((g) => g.system === system.id).length +
        uploadedRoms.filter((r) => r.system === system.id).length,
    ]),
  ) as Record<string, number>;

  return (
    <aside
      className={`${alwaysVisible ? "flex" : "hidden lg:flex"} flex-col w-full lg:w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-full`}
      data-testid="nav-sidebar"
    >
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link
          href={filterToPath("favorites")}
          onClick={onNavigate}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="link-home"
        >
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <Group label="Library">
          <NavItem
            icon={<Heart className="size-4" />}
            label="Favorites"
            count={favCount}
            href={filterToPath("favorites")}
            selected={!onSettingsRoute && active === "favorites"}
            onNavigate={onNavigate}
            testId="nav-favorites"
          />
          <NavItem
            icon={<Clock className="size-4" />}
            label="Recently Played"
            count={recentCount}
            href={filterToPath("recent")}
            selected={!onSettingsRoute && active === "recent"}
            onNavigate={onNavigate}
            testId="nav-recent"
          />
          <NavItem
            icon={<LayoutGrid className="size-4" />}
            label="All Games"
            count={allCount}
            href={filterToPath("all")}
            selected={!onSettingsRoute && active === "all"}
            onNavigate={onNavigate}
            testId="nav-all"
          />
          {(backlogCount > 0 || playingCount > 0 || completedCount > 0) && (
            <>
              <NavItem
                icon={<BookMarked className="size-4" />}
                label="Backlog"
                count={backlogCount}
                href={filterToPath("backlog" as any)}
                selected={!onSettingsRoute && (active as string) === "backlog"}
                onNavigate={onNavigate}
                testId="nav-backlog"
              />
              {playingCount > 0 && (
                <NavItem
                  icon={<Gamepad2 className="size-4" />}
                  label="Now Playing"
                  count={playingCount}
                  href={filterToPath("playing" as any)}
                  selected={!onSettingsRoute && (active as string) === "playing"}
                  onNavigate={onNavigate}
                  testId="nav-playing"
                />
              )}
              {completedCount > 0 && (
                <NavItem
                  icon={<CheckCircle2 className="size-4" />}
                  label="Completed"
                  count={completedCount}
                  href={filterToPath("completed" as any)}
                  selected={!onSettingsRoute && (active as string) === "completed"}
                  onNavigate={onNavigate}
                  testId="nav-completed"
                />
              )}
            </>
          )}
        </Group>

        <Group label="Systems">
          {SYSTEMS.map((s) => (
            <NavItem
              key={s.id}
              icon={
                <span
                  className="inline-block size-3.5 rounded-sm shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${s.art[0]}), hsl(${s.art[1]}))`,
                  }}
                />
              }
              label={s.shortName}
              count={systemCounts[s.id] ?? 0}
              href={filterToPath(s.id)}
              selected={!onSettingsRoute && active === s.id}
              onNavigate={onNavigate}
              testId={`nav-system-${s.id}`}
            />
          ))}
        </Group>

        {collections.length > 0 ? (
          <Group label="Collections">
            {collections.map((collection) => (
              <NavItem
                key={collection.id}
                icon={<Folder className="size-4" />}
                label={collection.name}
                count={collection.romIds.length}
                href={filterToPath(`collection:${collection.id}` as Filter)}
                selected={!onSettingsRoute && active === `collection:${collection.id}`}
                onNavigate={onNavigate}
                testId={`nav-collection-${collection.id}`}
              />
            ))}
          </Group>
        ) : null}
      </nav>

      <div className="px-3 pb-3 border-t border-sidebar-border pt-3 space-y-2">
        <Link
          href="/achievements"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium hover-elevate active-elevate-2 ${
            location.startsWith("/achievements") ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"
          } ${kioskMode ? "hidden" : ""}`}
          data-testid="link-achievements"
        >
          <Trophy className="size-4" />
          Achievements
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium hover-elevate active-elevate-2 ${
            onSettingsRoute ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"
          } ${kioskMode ? "hidden" : ""}`}
          data-testid="link-settings"
        >
          <SettingsIcon className="size-4" />
          Integration & Settings
        </Link>
      </div>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  count,
  href,
  selected,
  onNavigate,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  href: string;
  selected: boolean;
  onNavigate?: () => void;
  testId: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-testid={testId}
      data-state={selected ? "active" : "inactive"}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium hover-elevate active-elevate-2 transition-colors ${
        selected
          ? "bg-sidebar-accent text-foreground border border-sidebar-accent-border"
          : "text-muted-foreground"
      }`}
    >
      <span className={selected ? "text-primary" : ""}>{icon}</span>
      <span className="truncate flex-1 text-left">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {count.toLocaleString()}
        </span>
      ) : null}
    </Link>
  );
}
