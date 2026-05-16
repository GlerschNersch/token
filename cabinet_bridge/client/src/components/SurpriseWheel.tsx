import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Game } from "@/data/library";
import { Play, Info, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  games: Game[];
  onLaunch: (game: Game) => void;
  onOpenDetails: (game: Game) => void;
}

export function SurpriseWheel({ open, onClose, games, onLaunch, onOpenDetails }: Props) {
  const { t } = useTranslation();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Game | null>(null);
  const [displayGames, setDisplayGames] = useState<Game[]>([]);

  const startSpin = useCallback(() => {
    if (games.length === 0) return;
    setSpinning(true);
    setResult(null);

    // Create a large array for the "rolling" effect
    const rollCount = 40; 
    const randomGames: Game[] = [];
    for (let i = 0; i < rollCount; i++) {
      randomGames.push(games[Math.floor(Math.random() * games.length)]);
    }
    
    // The final game
    const finalGame = games[Math.floor(Math.random() * games.length)];
    randomGames.push(finalGame);
    
    setDisplayGames(randomGames);

    // Animation timing
    setTimeout(() => {
      setSpinning(false);
      setResult(finalGame);
    }, 4000); // Match this with CSS transition duration
  }, [games]);

  useEffect(() => {
    if (open) {
      startSpin();
    } else {
      setResult(null);
      setSpinning(false);
    }
  }, [open, startSpin]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-black/95 border-primary/20 backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-white/5">
          <DialogTitle className="flex items-center gap-2 text-xl font-display italic tracking-tight text-white">
            <Sparkles className="size-5 text-primary animate-pulse" />
            {t("home.actions.surprise").split(" — ")[0]}
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-[300px] flex items-center justify-center overflow-hidden bg-gradient-to-b from-primary/5 via-transparent to-primary/5">
          {/* Central Indicator */}
          <div className="absolute inset-x-0 h-24 border-y border-primary/40 bg-primary/10 z-10 pointer-events-none flex items-center justify-between px-4">
             <div className="w-1 h-12 bg-primary rounded-full shadow-[0_0_15px_hsl(var(--primary))]" />
             <div className="w-1 h-12 bg-primary rounded-full shadow-[0_0_15px_hsl(var(--primary))]" />
          </div>

          {/* Rolling List */}
          <motion.div
            className="flex flex-col items-center gap-4 py-[500px]"
            animate={{ 
              y: spinning ? -((displayGames.length - 1) * 116) : 0 
            }}
            transition={{ 
              duration: 4, 
              ease: [0.45, 0.05, 0.55, 0.95] 
            }}
            initial={{ y: 0 }}
          >
            {displayGames.map((g, i) => (
              <div 
                key={i} 
                className="h-24 w-[400px] shrink-0 rounded-xl border border-white/10 bg-white/5 p-3 flex gap-4 items-center"
              >
                <div 
                  className="size-16 rounded-lg shrink-0 overflow-hidden border border-white/10"
                  style={{ background: `linear-gradient(135deg, hsl(${g.art[0]}), hsl(${g.art[1]}))` }}
                >
                  {g.artUrl && <img src={g.artUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-white truncate">{g.title}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">{g.system}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Result Actions */}
        <div className="p-8 bg-white/5 border-t border-white/5 flex flex-col items-center gap-6 min-h-[160px]">
          <AnimatePresence mode="wait">
            {!spinning && result ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex flex-col items-center gap-6 w-full"
              >
                <div className="text-center space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Your next quest</div>
                  <div className="font-display text-2xl font-bold text-white">{result.title}</div>
                </div>

                <div className="flex gap-3">
                  <Button size="lg" className="h-12 px-8 gap-2 font-mono uppercase tracking-wider" onClick={() => onLaunch(result)}>
                    <Play className="size-4 fill-current" />
                    {t("common.ui.play")}
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8 gap-2 font-mono uppercase tracking-wider border-white/20 hover:bg-white/10" onClick={() => onOpenDetails(result)}>
                    <Info className="size-4" />
                    {t("common.ui.details")}
                  </Button>
                  <Button size="lg" variant="ghost" className="h-12 px-4 text-white/40 hover:text-white" onClick={startSpin}>
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-40">
                <Shuffle className="size-8 animate-spin-slow" />
                <div className="font-mono text-xs uppercase tracking-widest">Consulting the fates...</div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
