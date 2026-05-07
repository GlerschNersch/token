import { useEffect, useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IntegrationProvider } from "@/lib/integration";
import { parseFilter, parseCollectionFilter, DEFAULT_FILTER } from "@/lib/filter";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Player from "@/pages/Player";
import Achievements from "@/pages/Achievements";
import NotFound from "@/pages/not-found";

export const THEMES = ["default", "synthwave", "gameboy", "oled"] as const;
export type AppTheme = (typeof THEMES)[number];

export function applyTheme(theme: AppTheme) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("ha-theme", theme);
}

function AppRouter({
  arcadeMode,
  onToggleArcade,
}: {
  arcadeMode: boolean;
  onToggleArcade: () => void;
}) {
  return (
    <Switch>
      <Route path="/">
        <Home filter={DEFAULT_FILTER} arcadeMode={arcadeMode} onToggleArcade={onToggleArcade} />
      </Route>
      <Route path="/library/collection/:id">
        {(params) => (
          <Home
            filter={parseCollectionFilter(params.id)}
            arcadeMode={arcadeMode}
            onToggleArcade={onToggleArcade}
          />
        )}
      </Route>
      <Route path="/library/:filter">
        {(params) => (
          <Home
            filter={parseFilter(params.filter)}
            arcadeMode={arcadeMode}
            onToggleArcade={onToggleArcade}
          />
        )}
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/play/:id">
        {(params) => <Player id={params.id} />}
      </Route>
      <Route path="/achievements">
        <Achievements />
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

  const [arcadeMode, setArcadeMode] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("crt", arcadeMode);
    return () => document.body.classList.remove("crt");
  }, [arcadeMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <IntegrationProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <div className="h-dvh min-h-dvh flex flex-col">
              <AppRouter
                arcadeMode={arcadeMode}
                onToggleArcade={() => setArcadeMode((v) => !v)}
              />
            </div>
          </Router>
        </TooltipProvider>
      </IntegrationProvider>
    </QueryClientProvider>
  );
}

export default App;
