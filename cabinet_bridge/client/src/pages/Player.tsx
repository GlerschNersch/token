import { apiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { UploadedRom } from "@shared/schema";
import { ArrowLeft, ExternalLink, Gamepad2, Save } from "lucide-react";
import { Link } from "wouter";

export default function Player({ id }: { id: string }) {
  const romId = Number(id);
  const { data: rom, isLoading, error } = useQuery<UploadedRom>({
    queryKey: [`/api/roms/${romId}`],
    enabled: Number.isFinite(romId),
  });

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
              Player helper
            </p>
            <h1 className="truncate font-display text-lg font-bold" data-testid="text-player-title">
              {isLoading ? "Loading ROM..." : rom?.title ?? "ROM unavailable"}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <a
            href={playerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20"
            data-testid="link-standalone-player"
          >
            <ExternalLink className="size-3" />
            Play now
          </a>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
            <Save className="size-3" />
            Local saves
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
            <Gamepad2 className="size-3" />
            Menu controls
          </span>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-3" data-testid="panel-player-help">
        <div className="rounded-lg border border-card-border bg-card/80 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Save mode
          </p>
          <p className="mt-1 text-xs text-foreground">
            Save State and Load State use this browser for now.
          </p>
        </div>
        <div className="rounded-lg border border-card-border bg-card/80 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Controls
          </p>
          <p className="mt-1 text-xs text-foreground">
            Open Control Settings in the emulator menu to map keyboard or gamepad.
          </p>
        </div>
        <div className="rounded-lg border border-card-border bg-card/80 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Test play
          </p>
          <p className="mt-1 text-xs text-foreground">
            Click inside the game frame, then press Enter to start.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2" data-testid="panel-keyboard-controls">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Keyboard defaults
        </p>
        <p className="mt-1 text-xs text-foreground">
          The library now opens this player directly. If you land here, use Play now above.
        </p>
        {rom?.system === "ps1" || rom?.system === "ps2" ? (
          <div className="mt-2 grid gap-2 text-xs text-foreground sm:grid-cols-4">
            <div><span className="font-mono text-muted-foreground">Start</span> Enter</div>
            <div><span className="font-mono text-muted-foreground">Select</span> Shift</div>
            <div><span className="font-mono text-muted-foreground">D-Pad</span> Arrow keys</div>
            <div><span className="font-mono text-muted-foreground">Cross / Circle</span> Z / X</div>
            <div><span className="font-mono text-muted-foreground">Square / Triangle</span> A / S</div>
            <div><span className="font-mono text-muted-foreground">L1 / R1</span> Q / W</div>
            <div><span className="font-mono text-muted-foreground">L2 / R2</span> E / R</div>
            <div><span className="font-mono text-muted-foreground">L3 / R3</span> Tab / C</div>
            <div><span className="font-mono text-muted-foreground">Quick save</span> 1</div>
            <div><span className="font-mono text-muted-foreground">Quick load</span> 2</div>
          </div>
        ) : (
          <div className="mt-2 grid gap-2 text-xs text-foreground sm:grid-cols-4">
            <div><span className="font-mono text-muted-foreground">Start</span> Enter</div>
            <div><span className="font-mono text-muted-foreground">Select</span> Shift</div>
            <div><span className="font-mono text-muted-foreground">Move</span> Arrow keys</div>
            <div><span className="font-mono text-muted-foreground">A / B</span> Z / X</div>
            <div><span className="font-mono text-muted-foreground">X / Y</span> A / S</div>
            <div><span className="font-mono text-muted-foreground">L / R</span> Q / W</div>
            <div><span className="font-mono text-muted-foreground">Quick save</span> 1</div>
            <div><span className="font-mono text-muted-foreground">Quick load</span> 2</div>
          </div>
        )}
      </section>

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
