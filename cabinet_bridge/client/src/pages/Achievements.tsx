import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Trophy, 
  Target, 
  Zap, 
  Gamepad2, 
  ChevronRight, 
  Star,
  Lock,
  Loader2,
  AlertCircle
} from "lucide-react";
import { SYSTEMS } from "@/data/library";
import { useIntegration } from "@/lib/integration";
import { MobileTopBar } from "@/components/MobileNav";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Achievements() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const raUsername = config.raUsername ?? "";
  const raToken = config.raToken ?? "";
  const hasCredentials = !!(raUsername && raToken);

  const { data: summary, isLoading } = useQuery<{
    totalPoints: number;
    totalAchievements: number;
    recentAchievements: any[];
    games: any[];
  }>({
    queryKey: ["/api/retroachievements/summary"],
    enabled: hasCredentials,
  });

  if (!hasCredentials) {
    return (
      <div className="flex-1 min-w-0 flex flex-col h-full bg-background/30 overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center overscroll-y-contain">
          <div className="max-w-md space-y-6">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto ring-8 ring-primary/5">
              <Trophy className="size-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t("achievements.locked")} || "Achievements Locked"
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your <strong>RetroAchievements.org</strong> account to track your progress, unlock trophies, and see your world ranking.
              </p>
            </div>
            <Link href="/settings">
              <Button size="lg" className="w-full gap-2 font-mono uppercase tracking-wider">
                <Target className="size-4" /> {t("achievements.connect")} || "Connect Account"
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground/20" />
    </div>
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background/30 overflow-hidden">
      <MobileTopBar />
      <main className="flex-1 overflow-y-auto overscroll-y-contain pb-24 lg:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("achievements.header") || "Hall of Fame"}
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight mt-1">
                {t("achievements.title") || "RetroAchievements"}
              </h1>
            </div>
            <div className="flex items-center gap-4 bg-sidebar/40 border border-border px-4 py-2 rounded-full">
               <div className="text-right">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Global Rank</div>
                  <div className="text-sm font-bold text-foreground">#{summary?.totalPoints ? '4,281' : '—'}</div>
               </div>
               <div className="w-px h-8 bg-border" />
               <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                    {raUsername[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{raUsername}</span>
               </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: "Total Points", value: summary?.totalPoints?.toLocaleString() ?? "0", icon: Trophy, color: "text-yellow-500" },
               { label: "Achievements", value: String(summary?.totalAchievements ?? 0), icon: Star, color: "text-primary" },
               { label: "Games Played", value: String(summary?.games?.length ?? 0), icon: Gamepad2, color: "text-accent" },
               { label: "Completion", value: "12%", icon: Target, color: "text-green-500" },
             ].map(s => (
               <div key={s.label} className="p-5 rounded-2xl border border-border bg-sidebar/20 space-y-3">
                  <s.icon className={`size-5 ${s.color} opacity-80`} />
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</div>
                    <div className="text-2xl font-display font-bold">{s.value}</div>
                  </div>
               </div>
             ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Recent Earned */}
            <div className="space-y-6">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider flex items-center gap-2">
                <Zap className="size-4 text-accent" /> Recently Unlocked
              </h2>
              <div className="space-y-3">
                {summary?.recentAchievements?.map((a, i) => (
                  <div key={i} className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-sidebar/5 hover:bg-sidebar/15 transition-all">
                    <div className="size-12 rounded-lg bg-background/50 border border-border flex items-center justify-center shrink-0 relative overflow-hidden">
                       {a.BadgeName ? (
                         <img src={`https://retroachievements.org/Badge/${a.BadgeName}.png`} className="w-full h-full object-contain" />
                       ) : (
                         <Trophy className="size-6 text-muted-foreground/20" />
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-foreground truncate group-hover:text-primary transition-colors">{a.Title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{a.Description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-primary">+{a.Points}</div>
                      <div className="text-[9px] font-mono text-muted-foreground uppercase">{formatRelative(new Date(a.Date).getTime())}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* In Progress Games */}
            <div className="space-y-6">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider flex items-center gap-2">
                <Target className="size-4 text-primary" /> Active Hunt
              </h2>
              <div className="space-y-3">
                {summary?.games?.slice(0, 5).map((g, i) => (
                  <div key={i} className="group p-4 rounded-xl border border-border bg-sidebar/5 hover:bg-sidebar/15 transition-all space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-lg bg-background/50 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                         <img src={`https://retroachievements.org${g.ImageIcon}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-foreground truncate group-hover:text-primary transition-colors">{g.Title}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{g.ConsoleName}</div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                          <span className="text-muted-foreground">Trophies: <b className="text-foreground">{g.NumAwarded}/{g.NumAchievements}</b></span>
                          <span className="text-primary font-bold">{Math.round((g.NumAwarded / g.NumAchievements) * 100)}%</span>
                       </div>
                       <Progress value={(g.NumAwarded / g.NumAchievements) * 100} className="h-1 bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function Button({ children, className, ...props }: any) {
  return (
    <button className={`inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${className}`} {...props}>
      {children}
    </button>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
