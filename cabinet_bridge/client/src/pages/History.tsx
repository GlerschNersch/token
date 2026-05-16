import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MobileTopBar } from "@/components/MobileNav";
import { SYSTEMS, uploadedRomToGame } from "@/data/library";
import type { UploadedRom } from "@shared/schema";
import { Clock, Gamepad2, TrendingUp, Calendar, ArrowLeft, BarChart2, ChevronLeft, Download } from "lucide-react";
import { apiUrl } from "@/lib/queryClient";
import { useIntegration } from "@/lib/integration";
import { useTranslation } from "react-i18next";

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

function fmtDate(ts: number, t: any) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return t("common.today");
  if (diffDays === 1) return t("common.yesterday");
  if (diffDays < 7) return t("common.xDaysAgo", { count: diffDays });
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
  const { t } = useTranslation();
  const { config } = useIntegration();
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
      const label = fmtDate(s.startedAt, t);
      const arr = groups.get(label) ?? [];
      arr.push(s);
      groups.set(label, arr);
    }
    return Array.from(groups.entries());
  }, [sessions, t]);

  const systemLabel = (id: string) => SYSTEMS.find((s) => s.id === id)?.name ?? id;

  const exportCsv = () => {
    const header = ["Date", "Time", "Game", "System", "Duration (s)", "Duration"];
    const rows = [...sessions]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((s) => [
        new Date(s.startedAt).toLocaleDateString(),
        new Date(s.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        `"${s.romTitle.replace(/"/g, '""')}"`,
        s.romSystem.toUpperCase(),
        String(s.durationSeconds ?? 0),
        fmtDuration(s.durationSeconds),
      ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homearcade-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Per-game drill-down
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);

  const gameSessions = useMemo(() => {
    if (!selectedGameKey) return [];
    return sessions
      .filter((s) => `${s.romSystem}:${s.romTitle}` === selectedGameKey)
      .sort((a, b) => b.startedAt - a.startedAt);
  }, [sessions, selectedGameKey]);

  const selectedGameInfo = useMemo(() => {
    if (!selectedGameKey || gameSessions.length === 0) return null;
    const first = gameSessions[gameSessions.length - 1];
    const totalSec = gameSessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    const avgSec = Math.round(totalSec / gameSessions.length);
    const rom = romMap.get(first.romId);
    return {
      title: first.romTitle,
      system: first.romSystem,
      rom,
      totalSec,
      avgSec,
      sessionCount: gameSessions.length,
      firstPlayed: first.startedAt,
      lastPlayed: gameSessions[0].startedAt,
    };
  }, [selectedGameKey, gameSessions, romMap]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <MobileTopBar />
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 lg:pb-8 space-y-8">

          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-foreground">{t("history.title")}</h1>
              <p className="text-sm text-muted-foreground font-mono">
                {t("history.sessionsCount", { count: sessions.length })}
              </p>
            </div>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title={t("history.exportCsv")}
              >
                <Download className="size-3.5" /> {t("history.exportCsv")}
              </button>
            )}
          </div>

          {/* ── Per-game drill-down ── */}
          {selectedGameKey && selectedGameInfo && (
            <div className="space-y-6">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setSelectedGameKey(null)}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-3.5" /> {t("history.allGames")}
              </button>

              {/* Game header */}
              <div className="flex items-center gap-4">
                {selectedGameInfo.rom?.artUrl ? (
                  <img
                    src={apiUrl(selectedGameInfo.rom.artUrl)}
                    alt=""
                    className="size-16 rounded-lg object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="size-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border">
                    <Gamepad2 className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                {config.showSystemLabels && (
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {systemLabel(selectedGameInfo.system)}
                </div>
                )}
                <h2 className="font-display text-xl font-bold text-foreground leading-tight line-clamp-2">
                {selectedGameInfo.title}
                </h2>
                </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                { label: t("history.stats.totalTime"), icon: <Clock className="size-3" />, value: fmtDuration(selectedGameInfo.totalSec), color: "text-primary" },
                { label: t("history.stats.sessions"), icon: <BarChart2 className="size-3" />, value: String(selectedGameInfo.sessionCount), color: "text-blue-400" },
                { label: t("history.stats.avgSession"), icon: <TrendingUp className="size-3" />, value: fmtDuration(selectedGameInfo.avgSec), color: "text-yellow-400" },
                { label: t("history.stats.firstPlayed"), icon: <Calendar className="size-3" />, value: fmtDate(selectedGameInfo.firstPlayed, t), color: "text-green-400" },
                ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
                <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${stat.color}`}>
                {stat.icon} {stat.label}
                </div>
                <div className="font-display text-xl font-bold text-foreground">{stat.value}</div>
                </div>
                ))}
                </div>

                {/* Session list */}
                <div className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-foreground">{t("history.allSessions")}</h3>
                {gameSessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-4 py-3">
                <div className="font-mono text-[10px] text-muted-foreground/50 w-5 text-right shrink-0">
                {gameSessions.length - i}
                </div>
                <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{ backgroundColor: systemColor(s.romSystem) }}
                />
                <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] text-muted-foreground">{fmtDate(s.startedAt, t)}</div>
                <div className="font-mono text-[9px] text-muted-foreground/50">{fmtTime(s.startedAt)}</div>
                </div>
                <div className="font-mono text-sm font-semibold text-foreground shrink-0">
                {fmtDuration(s.durationSeconds)}
                </div>
                </div>
                ))}
                </div>
                </div>
                )}

                {!selectedGameKey && isLoading ? (
                <div className="flex justify-center py-20">
                <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
                ) : !selectedGameKey && sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Gamepad2 className="size-10 opacity-30" />
                <p className="font-mono text-sm uppercase tracking-wider">{t("history.noSessions")}</p>
                <p className="text-sm">{t("history.startTracking")}</p>
                </div>
                ) : !selectedGameKey ? (
                <>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                <Clock className="size-3" /> {t("history.stats.totalPlaytime")}
                </div>
                <div className="font-display text-2xl font-bold">{fmtDuration(totalSeconds)}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{t("history.sessionsCount", { count: sessions.length })}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-400">
                <TrendingUp className="size-3" /> {t("history.stats.mostPlayed")}
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
                <Calendar className="size-3" /> {t("history.stats.lastSession")}
                </div>
                <div className="font-display text-lg font-bold leading-tight line-clamp-1">
                {sessions[0]?.romTitle ?? "—"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                {sessions[0] ? fmtDate(sessions[0].startedAt, t) : ""}
                </div>
                </div>
                </div>

                {/* Top games bar chart */}
                {topGames.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-sm font-semibold text-foreground mb-4">{t("history.topGames")}</h2>
                <div className="space-y-3">
                {topGames.map((g) => (
                <div key={`${g.system}:${g.title}`} className="space-y-1 cursor-pointer group" onClick={() => setSelectedGameKey(`${g.system}:${g.title}`)}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-foreground line-clamp-1 flex-1 mr-4 group-hover:text-primary transition-colors">{g.title}</span>
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
                    {config.showSystemLabels && `${systemLabel(g.system)} · `}{t("history.stats.sessionsCount", { count: g.sessions })}
                  </div>
                </div>
                ))}
                </div>
                </div>
                )}

                {/* Session log grouped by day */}
                <div className="space-y-6">
                <h2 className="font-display text-sm font-semibold text-foreground">{t("history.sessionLog")}</h2>
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
                      className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 hover:bg-card transition-colors cursor-pointer"
                      onClick={() => setSelectedGameKey(`${s.romSystem}:${s.romTitle}`)}
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
                        {config.showSystemLabels && (
                          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                            {systemLabel(s.romSystem)}
                          </div>
                        )}
                      </div>                            {/* Time + duration */}
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
