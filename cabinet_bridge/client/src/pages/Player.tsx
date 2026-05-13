import { useState } from "react";
import { apiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useIntegration } from "@/lib/integration";
import { ConsoleSilhouette } from "@/components/ConsoleSilhouette";
import type { UploadedRom } from "@shared/schema";
import { ArrowLeft, ExternalLink, Gamepad2, Save, Keyboard, Settings2 } from "lucide-react";
import { Link } from "wouter";

export default function Player({ id }: { id: string }) {
  const romId = Number(id);
  const { config } = useIntegration();
  const { data: rom, isLoading, error } = useQuery<UploadedRom>({
    queryKey: [`/api/roms/${romId}`],
    enabled: Number.isFinite(romId),
  });

  const [showRemap, setShowRemap] = useState(false);

  const playerUrl = apiUrl(`/api/roms/${romId}/player`);

  return (
    <main className="min-h-dvh bg-background text-foreground p-3 sm:p-4 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border bg-card px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <Button variant="outline" size="sm" data-testid="button-back-library">
              <ArrowLeft className="size-4" />
              Library
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Playing on HomeArcade
            </p>
            <h1 className="truncate font-display text-lg font-bold" data-testid="text-player-title">
              {isLoading ? "Loading ROM..." : rom?.title ?? "ROM unavailable"}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRemap(!showRemap)}
            className="h-8 gap-1.5 font-mono text-[10px] uppercase tracking-wider"
          >
            <Settings2 className="size-3" />
            {showRemap ? "Hide controls" : "Remap controls"}
          </Button>
          <a
            href={playerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary hover:bg-primary/20 transition-colors"
            data-testid="link-standalone-player"
          >
            <ExternalLink className="size-3" />
            Pop-out
          </a>
        </div>
      </header>

      {showRemap && rom && (
        <section className="rounded-xl border border-primary/30 bg-black/40 backdrop-blur-md p-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2">
           <div className="absolute inset-0 opacity-5 pointer-events-none">
             <ConsoleSilhouette systemId={rom.system} />
           </div>
           <div className="relative flex flex-col sm:flex-row gap-6">
             <div className="w-full sm:w-48 aspect-video sm:aspect-square rounded-lg border border-white/10 bg-black/40 flex items-center justify-center relative">
                <ConsoleSilhouette systemId={rom.system} />
             </div>
             <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="size-4 text-primary" />
                  <h2 className="font-display font-bold uppercase tracking-wider">Control Helper</h2>
                </div>
                <p className="text-xs text-muted-foreground max-w-prose">
                  These are your global defaults for {rom.system.toUpperCase()}. To change them or remap your gamepad, go to <strong>Settings &gt; Controls</strong>.
                  Press <kbd className="bg-muted px-1 rounded text-foreground">ESC</kbd> in-game to access the emulator's core menu.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   {/* Simplified view of current mappings */}
                   <div className="space-y-1">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">D-Pad</div>
                      <div className="text-xs font-semibold">Arrow Keys</div>
                   </div>
                   <div className="space-y-1">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">A / B</div>
                      <div className="text-xs font-semibold">Z / X</div>
                   </div>
                   <div className="space-y-1">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">Start / Select</div>
                      <div className="text-xs font-semibold">Enter / Shift</div>
                   </div>
                   <div className="space-y-1">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">Save / Load</div>
                      <div className="text-xs font-semibold text-primary">1 / 2</div>
                   </div>
                </div>
             </div>
           </div>
        </section>
      )}

      {error ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm" data-testid="state-player-error">
          This ROM could not be loaded. Return to Settings and confirm it uploaded correctly.
        </section>
      ) : (
        <section className="relative flex-1 min-h-[70vh] overflow-hidden rounded-lg border border-card-border bg-black shadow-2xl">
          <iframe
            title={rom ? `Play ${rom.title}` : "HomeArcade player"}
            src={playerUrl}
            allow="gamepad; fullscreen; autoplay"
            className="absolute inset-0 h-full w-full border-0"
            data-testid="iframe-emulator"
          />
        </section>
      )}
    </main>
  );
}
