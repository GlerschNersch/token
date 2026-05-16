import { useState } from "react";
import { MobileTopBar } from "@/components/MobileNav";
import { useIntegration } from "@/lib/integration";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Star, Zap, Clock } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface RARecentAchievement {
  Title: string;
  Description: string;
  BadgeName: string;
  GameTitle: string;
  AchievementID: number;
  Date: string;
  HardcoreMode: string;
}

interface RAUserSummary {
  TotalPoints: number;
  TotalSoftcorePoints: number;
  Rank: number;
  TotalRanked: number;
  RecentlyPlayedCount: number;
  RecentAchievements: Record<string, Record<string, RARecentAchievement>>;
  Awarded?: Record<string, { NumAchievements: number; NumAwardedHardcore: number }>;
}

interface RAGameProgress {
  Title: string;
  NumAchievements: number;
  NumAwardedToUser: number;
  NumAwardedToUserHardcore: number;
  PctWon: string;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function Achievements() {
  const { config } = useIntegration();
  const { t } = useTranslation();
  const raUsername = config.raUsername ?? "";
  const raToken = config.raToken ?? "";
  const hasCredentials = !!(raUsername && raToken);

  const { data: summary, isLoading, error } = useQuery<RAUserSummary>({
    queryKey: ["ra-summary", raUsername],
    enabled: hasCredentials,
    queryFn: async () => {
      const url = `https://retroachievements.org/API/API_GetUserSummary.php?z=${encodeURIComponent(raUsername)}&y=${encodeURIComponent(raToken)}&u=${encodeURIComponent(raUsername)}&g=5&a=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`RA API error ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const recentAchievements = summary?.RecentAchievements
    ? Object.values(summary.RecentAchievements).flatMap((gameMap) =>
        Object.values(gameMap)
      ).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()).slice(0, 20)
    : [];

  return (
    <div className="flex h-full">
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto" data-testid="page-achievements">
        <MobileTopBar active="favorites" />

        <div className="px-5 sm:px-10 py-6 sm:py-10 max-w-3xl w-full mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-3.5" /> {t("nav.home")}
          </Link>

          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("achievements.title")}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-2 flex items-center gap-2">
            <Trophy className="size-6 text-yellow-400" />
            {raUsername ? t("achievements.trophies", { user: raUsername }) : t("achievements.dashboard")}
          </h1>

          {!hasCredentials && (
            <div className="mt-6 rounded-md border border-border bg-background/50 p-6 text-center" data-testid="state-no-ra-credentials">
              <Trophy className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">{t("achievements.noAccount")}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {t("achievements.credentialsHint")}
              </p>
              <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                {t("nav.settings")} →
              </Link>
            </div>
          )}

          {hasCredentials && isLoading && (
            <div className="mt-8 text-sm text-muted-foreground animate-pulse" data-testid="state-ra-loading">
              {t("common.loading")}
            </div>
          )}

          {hasCredentials && error && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" data-testid="state-ra-error">
              {t("achievements.error")}
            </div>
          )}

          {hasCredentials && summary && (
            <>
              {/* Stats row */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="ra-stats">
                <StatCard icon={<Trophy className="size-4 text-yellow-400" />} label={t("achievements.stats.hardcorePoints")} value={summary.TotalPoints?.toLocaleString() ?? "—"} />
                <StatCard icon={<Star className="size-4 text-blue-400" />} label={t("achievements.stats.softcorePoints")} value={summary.TotalSoftcorePoints?.toLocaleString() ?? "—"} />
                <StatCard icon={<Zap className="size-4 text-purple-400" />} label={t("achievements.stats.globalRank")} value={summary.Rank ? `#${summary.Rank.toLocaleString()}` : "—"} />
                <StatCard icon={<Clock className="size-4 text-emerald-400" />} label={t("achievements.stats.recentGames")} value={summary.RecentlyPlayedCount?.toString() ?? "—"} />
              </div>

              {/* Recent achievements */}
              {recentAchievements.length > 0 && (
                <section className="mt-8" data-testid="ra-recent-achievements">
                  <h2 className="font-display text-base font-semibold tracking-tight mb-3">{t("achievements.recentAchievements")}</h2>
                  <ul className="space-y-2">
                    {recentAchievements.map((ach) => (
                      <li
                        key={`${ach.AchievementID}-${ach.Date}`}
                        className="rounded-md border border-border bg-background/50 p-3 flex items-start gap-3"
                        data-testid={`row-achievement-${ach.AchievementID}`}
                      >
                        <div className="shrink-0 size-10 rounded-md bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                          <Trophy className={`size-5 ${ach.HardcoreMode === "1" ? "text-yellow-400" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{ach.Title}</div>
                          <div className="text-xs text-muted-foreground truncate">{ach.Description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-muted-foreground/60">{ach.GameTitle}</span>
                            {ach.HardcoreMode === "1" && (
                              <span className="font-mono text-[9px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">hardcore</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 font-mono text-[10px] text-muted-foreground/60 text-right">
                          {formatDate(ach.Date)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {recentAchievements.length === 0 && (
                <div className="mt-8 text-sm text-muted-foreground" data-testid="state-no-achievements">
                  {t("achievements.noRecentAchievements")}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      </div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}
