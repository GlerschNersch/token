import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileNav";
import { SYSTEMS, uploadedRomToGame } from "@/data/library";
import type { UploadedRom } from "@shared/schema";
import { Clock, Gamepad2, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import { apiUrl } from "@/lib/queryClient";

interface PlaySession {
  id: number;
  romId: number;
  romTitle: string;
  romSystem: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
}

function fmtDuration(sec: number | null) {
  if (!sec || sec <= 0) return "< 1m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: diffDays > 300 ? "numeric" : undefined });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function systemColor(systemId: string) {
  const colors: Record<string, string> = {
    nes: "#e53e3e", snes: "#6b46c1", n64: "#2f855a", gba: "#2b6cb0",
    genesis: "#c05621", ps1: "#2d3748", ps2: "#1a365d", arcade: "#b7791f",
    gb: "#276749", gbc: "#2c7a7b", nds: "#c53030", psp: "#2a4365",
    dreamcast: "#e53e3e", saturn: "#553c9a", atari2600: "#744210",
  };
  return colors[systemId] ?? "#553c9a";
}

export default function History() {
  const { data: sessions = [], isLoading } = useQuery<PlaySession[]>({
    queryKey: ["/api/sessions"],
  });
  const { data: uploadedRoms = [] } = useQuery<UploadedRom[]>({
    queryKey: ["/api/roms"],
  });

  const romMap = useMemo(() => {
    const m = new Map<number, UploadedRom>();
    for (const r of uploadedRoms) m.set(r.id, r);
    return m;
  }, [uploadedRoms]);

  // Stats
  const totalSeconds = useMemo(
    () => sessions.reduce((sum: number, s: PlaySession) => sum + (s.durationSeconds ?? 0), 0),
    [sessions],
  );

  const topGames = useMemo(() => {
    const byGame = new Map<string, { title: string; system: string; seconds: number; sessions: number }>();
    for (const s of sessions) {
      const key = `${s.romSystem}:${s.romTitle}`;
      const entry = byGame.get(key) ?? { title: s.romTitle, system: s.romSystem, seconds: 0, sessions: 0 };
      entry.seconds += s.durationSeconds ?? 0;
      entry.sessions += 1;
      byGame.set(key, entry);
    }
    return Array.from(byGame.values()).sort((a, b) => b.seconds - a.seconds).slice(0, 5);
  }, [sessions]);

  const maxSeconds = topGames[0]?.seconds ?? 1;

  // Group sessions by date
  const grouped = useMemo(() => {
    const groups = new Map<string, PlaySession[]>();
    for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
      const label = fmtDate(s.startedAt);
      const arr = groups.get(label) ?? [];
      arr.push(s);
      groups.set(label, arr);
    }
    return Array.from(groups.entries());
  }, [sessions]);

  const systemLabel = (id: string) => SYSTEMS.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar active={"all"} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <MobileTopBar />
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 lg:pb-8 space-y-8">

          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Play History</h1>
              <p className="text-sm text-muted-foreground font-mono">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} tracked
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Gamepad2 className="size-10 opacity-30" />
              <p className="font-mono text-sm uppercase tracking-wider">No sessions yet</p>
              <p className="text-sm">Play a game to start tracking your history.</p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    <Clock className="size-3" /> Total Playtime
                  </div>
                  <div className="font-display text-2xl font-bold">{fmtDuration(totalSeconds)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{sessions.length} sessions</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-400">
                    <TrendingUp className="size-3" /> Most Played
                  </div>
                  <div className="font-display text-lg font-bold leading-tight line-clamp-1">
                    {topGames[0]?.title ?? "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {topGames[0] ? fmtDuration(topGames[0].seconds) : ""}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-green-400">
                    <Calendar className="size-3" /> Last Session
                  </div>
                  <div className="font-display text-lg font-bold leading-tight line-clamp-1">
                    {sessions[0]?.romTitle ?? "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {sessions[0] ? fmtDate(sessions[0].startedAt) : ""}
                  </div>
                </div>
              </div>

              {/* Top games bar chart */}
              {topGames.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-display text-sm font-semibold text-foreground mb-4">Top Games by Playtime</h2>
                  <div className="space-y-3">
                    {topGames.map((g) => (
                      <div key={`${g.system}:${g.title}`} className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-medium text-foreground line-clamp-1 flex-1 mr-4">{g.title}</span>
                          <span className="font-mono text-[11px] text-muted-foreground shrink-0">{fmtDuration(g.seconds)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((g.seconds / maxSeconds) * 100)}%`,
                              backgroundColor: systemColor(g.system),
                            }}
                          />
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {systemLabel(g.system)} · {g.sessions} session{g.sessions !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Session log grouped by day */}
              <div className="space-y-6">
                <h2 className="font-display text-sm font-semibold text-foreground">Session Log</h2>
                {grouped.map(([dateLabel, daySessions]) => (
                  <div key={dateLabel} className="space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border pb-1.5">
                      {dateLabel}
                    </div>
                    <div className="space-y-1.5">
                      {daySessions.map((s) => {
                        const rom = romMap.get(s.romId);
                        const artUrl = rom?.artUrl;
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 hover:bg-card transition-colors"
                          >
                            {/* System color bar */}
                            <div
                              className="w-1 h-10 rounded-full shrink-0"
                              style={{ backgroundColor: systemColor(s.romSystem) }}
                            />
                            {/* Art thumbnail */}
                            {artUrl ? (
                              <img
                                src={apiUrl(artUrl)}
                                alt=""
                                className="size-10 rounded object-cover shrink-0 border border-border/50"
                              />
                            ) : (
                              <div className="size-10 rounded bg-secondary flex items-center justify-center shrink-0">
                                <Gamepad2 className="size-4 text-muted-foreground" />
                              </div>
                            )}
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground line-clamp-1">{s.romTitle}</div>
                              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                                {systemLabel(s.romSystem)}
                              </div>
                            </div>
                            {/* Time + duration */}
                            <div className="text-right shrink-0">
                              <div className="font-mono text-[11px] text-foreground">{fmtDuration(s.durationSeconds)}</div>
                              <div className="font-mono text-[9px] text-muted-foreground">{fmtTime(s.startedAt)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
