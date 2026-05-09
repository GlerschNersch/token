import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IntegrationProvider } from "@/lib/integration";
import { parseFilter, parseCollectionFilter, DEFAULT_FILTER } from "@/lib/filter";
import { MobileBottomNav } from "@/components/MobileNav";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
// Lazy — loaded only when navigated to
const Settings = lazy(() => import("@/pages/Settings"));
const Player = lazy(() => import("@/pages/Player"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const History = lazy(() => import("@/pages/History"));

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

/**
 * Fades the route area in whenever the hash location changes.
 * Uses the Web Animations API so we avoid adding a full animation library.
 * The container never remounts — only the inner Switch swaps children.
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const [loc] = useHashLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevLoc = useRef(loc);

  useEffect(() => {
    if (loc !== prevLoc.current && ref.current) {
      prevLoc.current = loc;
      ref.current.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 180, easing: "ease-out", fill: "both" },
      );
    }
  }, [loc]);

  return (
    <div ref={ref} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  );
}

export const THEMES = ["default", "synthwave", "gameboy", "oled", "nord", "amber", "dracula", "cyberpunk", "miami-vice", "c64", "arcade", "vaporwave", "grunge", "win95", "blockbuster", "aqua", "y2k", "halo"] as const;
export type AppTheme = (typeof THEMES)[number];

export function applyTheme(theme: AppTheme) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("ha-theme", theme);
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/">
        <Dashboard />
      </Route>
      <Route path="/library">
        <Home filter={DEFAULT_FILTER} />
      </Route>
      <Route path="/library/collection/:id">
        {(params) => (
          <Home filter={parseCollectionFilter(params.id)} />
        )}
      </Route>
      <Route path="/library/:filter">
        {(params) => (
          <Home filter={parseFilter(params.filter)} />
        )}
      </Route>
      <Route path="/settings">
        <Suspense fallback={<PageFallback />}><Settings /></Suspense>
      </Route>
      <Route path="/play/:id">
        {(params) => <Suspense fallback={<PageFallback />}><Player id={params.id} /></Suspense>}
      </Route>
      <Route path="/history">
        <Suspense fallback={<PageFallback />}><History /></Suspense>
      </Route>
      <Route path="/achievements">
        <Suspense fallback={<PageFallback />}><Achievements /></Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Dark is the default — this is a TV/cabinet UI.
  useEffect(() => {
    document.documentElement.classList.add("dark");
    // Restore saved theme on mount
    const saved = localStorage.getItem("ha-theme") as AppTheme | null;
    if (saved && saved !== "default") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <IntegrationProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            {/*
             * Root container — fills the viewport.
             * MobileBottomNav is fixed-position so it doesn't affect layout,
             * but pages must add pb-20 lg:pb-0 to their scroll containers
             * so content isn't hidden behind it.
             */}
            <div className="h-dvh min-h-dvh flex flex-col">
              <PageTransition>
                <AppRouter />
              </PageTransition>
              <MobileBottomNav />
            </div>
          </Router>
        </TooltipProvider>
      </IntegrationProvider>
    </QueryClientProvider>
  );
}

export default App;
