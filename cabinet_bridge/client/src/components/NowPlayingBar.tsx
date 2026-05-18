import React, { useEffect, useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NowPlayingData {
  playing: boolean;
  id: number;
  title: string;
  system: string;
  startedAt: number;
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `0:${String(seconds).padStart(2, "0")}`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const NowPlayingBar = memo(function NowPlayingBar() {
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const { data, isLoading } = useQuery<NowPlayingData>({
    queryKey: ["/api/now-playing"],
    refetchInterval: 10_000,
  });

  // Reset elapsed and dismissed state when a new game starts
  useEffect(() => {
    if (data?.startedAt) {
      setDismissed(false);
      setDismissing(false);
    }
  }, [data?.startedAt]);

  // Timer
  useEffect(() => {
    if (!data?.playing || !data?.startedAt) return;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - data.startedAt) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.playing, data?.startedAt]);

  // Auto-dismiss after 15 minutes of inactivity when playing=false
  // (handled by polling — if API says playing=false for 15+ min, hide)
  useEffect(() => {
    if (!data?.playing && data?.startedAt) {
      const idleMs = Date.now() - data.startedAt;
      if (idleMs > 15 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, [data]);

  const handleDismiss = () => {
    setDismissing(true);
    setTimeout(() => {
      setDismissed(true);
      setDismissing(false);
    }, 300);
  };

  const handleExit = async () => {
    try {
      await apiRequest("POST", "/api/roms/exit");
    } catch {
      // Fallback: navigate home
      window.location.href = "/";
    }
  };

  if (isLoading) {
    return (
      <div className="fixed bottom-[72px] left-0 right-0 z-50 mx-4 mb-2 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2.5">
          <Loader2 className="size-4 animate-spin text-white/40" />
          <span className="font-mono text-xs text-white/40 uppercase tracking-widest">Loading...</span>
        </div>
      </div>
    );
  }

  if (!data?.playing || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-[72px] left-0 right-0 z-50 mx-4 mb-2"
      >
        <div
          className={[
            "flex items-center gap-3 rounded-2xl bg-black/90 backdrop-blur-md border border-white/10 px-4 py-3",
            "transition-all duration-300",
            dismissing ? "opacity-0 scale-95" : "opacity-100 scale-100",
          ].join(" ")}
          data-testid="now-playing-bar"
        >
          {/* Art thumbnail */}
          <div className="relative shrink-0">
            <div
              className="w-12 h-12 rounded-xl overflow-hidden border border-white/10"
              style={{
                background: `linear-gradient(135deg, hsl(${data.id % 360} 70% 50%), hsl(${(data.id + 60) % 360} 60% 40%))`,
              }}
            >
              {/* Game art is loaded dynamically — show gradient fallback */}
              <img
                src={`/api/roms/${data.id}/art`}
                alt={data.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback: hide the broken image, show gradient only
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {/* Pulsing "now playing" indicator */}
            <span className="absolute -top-1 -right-1 flex size-3">
              <span className="absolute inline-flex size-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-400" />
            </span>
          </div>

          {/* Title + system */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-green-400 font-bold">
                Now Playing
              </span>
            </div>
            <div className="font-display font-bold text-white text-sm truncate leading-tight">
              {data.title}
            </div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
              {data.system}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3 text-white/30" />
              <span
                className="font-mono text-sm text-white/60 tabular-nums"
                data-testid="now-playing-timer"
              >
                {fmtTime(elapsed)}
              </span>
            </div>
          </div>

          {/* Return to game */}
          <a
            href={`/play/${data.id}`}
            data-testid="now-playing-return"
            className="shrink-0 flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 text-white/70 hover:text-white transition-all text-xs font-mono uppercase tracking-widest font-bold"
          >
            <Play className="size-3 fill-current" />
            Return
          </a>

          {/* Exit game */}
          <button
            type="button"
            data-testid="now-playing-exit"
            onClick={handleExit}
            className="shrink-0 size-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
            aria-label="Exit game"
          >
            <X className="size-4" />
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 size-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
            aria-label="Dismiss now playing bar"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});