import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IntegrationProvider, useIntegration } from "@/lib/integration";
import { parseFilter, parseCollectionFilter, DEFAULT_FILTER } from "@/lib/filter";
import { MobileBottomNav } from "@/components/MobileNav";
import i18n from "./lib/i18n";
import { useTranslation } from "react-i18next";
import Home from "@/pages/Home";
import { ProfileProvider } from "@/lib/useProfile";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import { THEMES, AppTheme } from "./lib/themes";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/Sidebar";

/**
 * Ensures scroll position is reset or restored correctly on navigation.
 */
function ScrollRestoration() {
  const [loc] = useHashLocation();
  useEffect(() => {
    // For most routes, reset scroll. Library/Home might need more complex logic but start with reset.
    window.scrollTo(0, 0);
  }, [loc]);
  return null;
}

// Lazy — loaded only when navigated to
const Settings = lazy(() => import("@/pages/Settings"));
const Player = lazy(() => import("@/pages/Player"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const History = lazy(() => import("@/pages/History"));

/**
 * Manages global visual effects and themes driven by Integration settings.
 */
function VisualEffectManager() {
  const { config } = useIntegration();

  useEffect(() => {
    // Apply theme
    const theme = config.theme || "default";
    if (theme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [config.theme]);

  return null;
}

/**
 * Syncs the i18n language when the integration language setting changes.
 */
function LanguageManager() {
  const { config } = useIntegration();
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = config.language ?? "en";
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [config.language, i18n]);

  return null;
}

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
      <ProfileProvider>
      <IntegrationProvider>
        <VisualEffectManager />
      <LanguageManager />
      <ScrollRestoration />
        <TooltipProvider>
          <SidebarProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <div className="h-dvh min-h-dvh flex w-full overflow-hidden">
                <Sidebar />
                <SidebarInset className="flex flex-col min-h-0 overflow-hidden">
                  <PageTransition>
                    <AppRouter />
                  </PageTransition>
                  <MobileBottomNav />
                </SidebarInset>
              </div>
            </Router>
          </SidebarProvider>
        </TooltipProvider>
      </IntegrationProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}

export default App;
