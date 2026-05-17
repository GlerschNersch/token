import React, { lazy, Suspense } from "react";
import { useIntegration } from "@/lib/integration";

// Lazy load themes to keep the initial bundle small
const NostalgiaTheme = lazy(() => import("@/components/dashboard-themes/NostalgiaTheme"));
const PlayHubTheme = lazy(() => import("@/components/dashboard-themes/PlayHubTheme"));
const ColorfulTheme = lazy(() => import("@/components/dashboard-themes/ColorfulTheme"));
const AlekfullNXTheme = lazy(() => import("@/components/dashboard-themes/AlekfullNXTheme"));
const ArtBookNextTheme = lazy(() => import("@/components/dashboard-themes/ArtBookNextTheme"));

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
      {theme === "playhub" && <PlayHubTheme />}
      {theme === "colorful" && <ColorfulTheme />}
      {theme === "alekfull-nx" && <AlekfullNXTheme />}
      {theme === "art-book" && <ArtBookNextTheme />}
      {(theme === "nostalgia" || !["playhub", "colorful", "alekfull-nx", "art-book"].includes(theme)) && <NostalgiaTheme />}
    </Suspense>
  );
}
