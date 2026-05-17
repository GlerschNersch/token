import React, { lazy, Suspense } from "react";
import { useIntegration } from "@/lib/integration";

// Lazy load themes to keep the initial bundle small
const NostalgiaTheme = lazy(() => import("@/components/dashboard-themes/NostalgiaTheme"));
const HorizonTheme = lazy(() => import("@/components/dashboard-themes/HorizonTheme"));
const PlayHubTheme = lazy(() => import("@/components/dashboard-themes/PlayHubTheme"));
const GameOSTheme = lazy(() => import("@/components/dashboard-themes/GameOSTheme"));
const SlateTheme = lazy(() => import("@/components/dashboard-themes/SlateTheme"));

function ThemeFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-black">
      <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

export default function Dashboard() {
  const { config } = useIntegration();
  const theme = config.dashboardTheme || "nostalgia";

  return (
    <Suspense fallback={<ThemeFallback />}>
      {theme === "horizon" && <HorizonTheme />}
      {theme === "playhub" && <PlayHubTheme />}
      {theme === "gameos" && <GameOSTheme />}
      {theme === "slate" && <SlateTheme />}
      {(theme === "nostalgia" || !["horizon", "playhub", "gameos", "slate"].includes(theme)) && <NostalgiaTheme />}
    </Suspense>
  );
}
