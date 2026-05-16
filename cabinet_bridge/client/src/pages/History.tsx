import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  History as HistoryIcon, 
  Clock, 
  Gamepad2, 
  ChevronRight, 
  ChevronLeft, 
  Calendar,
  BarChart3,
  Download,
  AlertCircle
} from "lucide-react";
import { SYSTEMS } from "@/data/library";
import { formatRelative, useIntegration } from "@/lib/integration";
import { MobileTopBar } from "@/components/MobileNav";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { useTranslation } from "react-i18next";
import type { UploadedRom } from "@shared/schema";
import { Button } from "@/components/ui/button";

export default function History() {
  const { t } = useTranslation();
  const { config } = useIntegration();
  const [selectedGameTitle, setSelectedGameTitle] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<Array<{ 
    id: number; 
    romId: number; 
    romTitle: string; 
    romSystem: string; 
    startedAt: number; 
    endedAt: number | null; 
    durationSeconds: number | null 
  }>>({
    queryKey: ["/api/sessions"],
  });

  const { data: roms = [] } = useQuery<UploadedRom[]>({ queryKey: ["/api/roms"] });

  const romMap = useMemo(() => new Map(roms.map(r => [r.id, r])), [roms]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const days: Record<string, typeof sessions> = {};
    sessions.forEach(s => {
      const date = new Date(s.startedAt).toLocaleDateString();
      if (!days[date]) days[date] = [];
      days[date].push(s);
    });
    return Object.entries(days).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [sessions]);

  // Top games chart data
  const topGames = useMemo(() => {
    const counts: Record<string, { minutes: number; sessions: number; system: string; id: number }> = {};
    sessions.forEach(s => {
      if (!counts[s.romTitle]) counts[s.romTitle] = { minutes: 0, sessions: 0, system: s.romSystem, id: s.romId };
      counts[s.romTitle].minutes += Math.round((s.durationSeconds || 0) / 60);
      counts[s.romTitle].sessions += 1;
    });
    return Object.entries(counts)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
  }, [sessions]);

  const selectedGameInfo = useMemo(() => {
    if (!selectedGameTitle) return null;
    const gameSessions = sessions.filter(s => s.romTitle === selectedGameTitle);
    if (gameSessions.length === 0) return null;
    const first = gameSessions[0];
    const totalSec = gameSessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    const avgSec = Math.round(totalSec / gameSessions.length);
    const rom = romMap.get(first.romId);
    return {
      title: first.romTitle,
      system: first.romSystem,
      rom,
      totalSec,
      avgSec,
      sessions: gameSessions.sort((a, b) => b.startedAt - a.startedAt)
    };
  }, [selectedGameTitle, sessions, romMap]);

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Clock className="size-8 animate-spin text-muted-foreground/20" />
    </div>
  );

  const exportCsv = () => {
    const headers = ["Date", "Time", "Game", "System", "Duration (s)", "Duration (formatted)"];
    const rows = sessions.map(s => {
      const d = new Date(s.startedAt);
      const dur = s.durationSeconds ?? 0;
      const fmt = dur < 60 ? `${dur}s` : `${Math.round(dur/60)}m`;
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        s.romTitle,
        s.romSystem,
        dur,
        fmt
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homearcade-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background/30 overflow-hidden">
      <MobileTopBar />

      <main className="flex-1 overflow-y-auto overscroll-y-contain pb-24 lg:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("history.header") || "Activity"}
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight mt-1">
                {selectedGameTitle ? selectedGameInfo?.title : (t("history.title") || "Play History")}
              </h1>
            </div>
            {!selectedGameTitle && sessions.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2 h-9 font-mono text-[10px] uppercase tracking-wider" onClick={exportCsv}>
                <Download className="size-3.5" /> Export CSV
              </Button>
            )}
          </div>

          {selectedGameTitle && selectedGameInfo ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
              <button 
                onClick={() => setSelectedGameTitle(null)}
                className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronLeft className="size-3.5" /> {t("history.allGames") || "Back to all history"}
              </button>

              {/* Game header */}
              <div className="flex items-center gap-4">
                {selectedGameInfo.rom?.artUrl ? (
                  <div className="size-20 rounded-lg overflow-hidden border border-border/50 shrink-0">
                    <img src={selectedGameInfo.rom.artUrl} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="size-20 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Gamepad2 className="size-8 text-primary/40" />
                  </div>
                )}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                    {SYSTEMS.find(s => s.id === selectedGameInfo.system)?.shortName ?? selectedGameInfo.system}
                  </div>
                  <h2 className="font-display text-xl font-bold">{selectedGameInfo.title}</h2>
                </div>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total Playtime", value: `${Math.round(selectedGameInfo.totalSec / 60)}m` },
                  { label: "Sessions", value: String(selectedGameInfo.sessions.length) },
                  { label: "Avg Session", value: `${Math.round(selectedGameInfo.avgSec / 60)}m` },
                  { label: "First Played", value: new Date(selectedGameInfo.sessions[selectedGameInfo.sessions.length-1].startedAt).toLocaleDateString() },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl border border-border bg-sidebar/20">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{s.label}</div>
                    <div className="text-xl font-display font-bold">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Session list */}
              <div className="space-y-4 pt-4">
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" /> All Sessions
                </h3>
                <div className="rounded-xl border border-border bg-sidebar/10 overflow-hidden divide-y divide-border/40">
                  {selectedGameInfo.sessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-background/20">
                      <div>
                        <div className="text-sm font-medium">{new Date(s.startedAt).toLocaleDateString()}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">{new Date(s.startedAt).toLocaleTimeString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-display">{Math.round((s.durationSeconds ?? 0) / 60)}m</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Duration</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Stats overview */}
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Chart */}
                <div className="lg:col-span-8 space-y-4">
                  <h2 className="text-sm font-display font-bold uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" /> Most Played Titles
                  </h2>
                  <div className="h-[240px] w-full bg-sidebar/10 rounded-2xl border border-border/50 p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topGames} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={100} 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontFamily: 'monospace' }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} onClick={(d) => setSelectedGameTitle(d.name)} className="cursor-pointer">
                          {topGames.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={systemColor(entry.system)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Totals */}
                <div className="lg:col-span-4 grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {[
                    { label: "Lifetime Playtime", value: `${Math.round(sessions.reduce((s,v) => s+(v.durationSeconds??0),0)/60)}m`, icon: Clock },
                    { label: "Total Sessions", value: String(sessions.length), icon: HistoryIcon },
                    { label: "Unique Games", value: String(new Set(sessions.map(s => s.romId)).size), icon: Gamepad2 },
                  ].map(s => (
                    <div key={s.label} className="p-5 rounded-2xl border border-border bg-sidebar/20 flex flex-col justify-between gap-4">
                       <s.icon className="size-5 text-muted-foreground/30" />
                       <div>
                         <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">{s.label}</div>
                         <div className="text-3xl font-display font-black text-foreground">{s.value}</div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feed */}
              <div className="space-y-6">
                <h2 className="text-sm font-display font-bold uppercase tracking-wider flex items-center gap-2">
                  <Clock className="size-4 text-accent" /> Recent Activity
                </h2>
                
                {groupedByDay.map(([day, daySessions]) => (
                  <div key={day} className="space-y-3">
                    <div className="sticky top-0 z-10 py-2 bg-background/95 backdrop-blur shadow-sm -mx-4 px-4 sm:mx-0 sm:px-0">
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">{day}</div>
                    </div>
                    <div className="grid gap-3">
                      {daySessions.sort((a,b) => b.startedAt - a.startedAt).map(s => (
                        <div 
                          key={s.id} 
                          className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-sidebar/5 hover:bg-sidebar/20 transition-all cursor-pointer"
                          onClick={() => setSelectedGameTitle(s.romTitle)}
                        >
                          <div className="size-10 rounded-lg bg-background/50 border border-border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                             <div className="size-3 rounded-full" style={{ background: systemColor(s.romSystem) }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-foreground truncate group-hover:text-primary transition-colors">{s.romTitle}</div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                               {config.showSystemLabels && (
                                 <span className="font-bold text-foreground/40">{SYSTEMS.find(sys => sys.id === s.romSystem)?.shortName ?? s.romSystem}</span>
                               )}
                               <span>· {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display font-bold text-foreground">{Math.round((s.durationSeconds ?? 0) / 60)}m</div>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">{s.durationSeconds ? 'Duration' : 'Current'}</div>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 gap-4 border-2 border-dashed border-border rounded-3xl">
                     <AlertCircle className="size-12" />
                     <div className="font-mono text-xs uppercase tracking-[0.3em]">No play history recorded yet</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function systemColor(systemId: string) {
  const colors: Record<string, string> = {
    nes: "#e53e3e", snes: "#6b46c1", n64: "#2f855a", gba: "#2b6cb0",
    genesis: "#c05621", ps1: "#2d3748", ps2: "#1a365d", arcade: "#b7791f",
    gb: "#276749", gbc: "#c05621", dreamcast: "#3182ce", psp: "#2b6cb0",
    nds: "#2d3748", atari2600: "#744210", saturn: "#2c5282", gamegear: "#2b6cb0",
    mastersystem: "#2c5282", tg16: "#c05621", "neo-geo": "#b7791f", virtualboy: "#e53e3e",
  };
  return colors[systemId] || "#718096";
}
