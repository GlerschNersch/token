import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, Wifi, Smartphone } from "lucide-react";
import { type Game } from "@/data/library";
import { apiUrl } from "@/lib/queryClient";

export function WarpLinkDialog({
  game,
  slot,
  onClose,
}: {
  game: Game | null;
  slot?: number | null;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!game) return;

    const generateWarp = async () => {
      setLoading(true);
      try {
        const returnTo = encodeURIComponent(window.location.origin + apiUrl("/"));
        // We use window.location.origin to ensure the mobile device hits the same host
        const baseUrl = window.location.origin + apiUrl(`/api/roms/${game.romId}/player?return=${returnTo}`);
        const warpUrl = new URL(baseUrl);
        if (slot !== undefined && slot !== null) {
          warpUrl.searchParams.set("loadSlot", String(slot));
        }
        warpUrl.searchParams.set("warp", "true");

        const res = await fetch(apiUrl(`/api/roms/warp-qr?url=${encodeURIComponent(warpUrl.toString())}`));
        const data = await res.json();
        setQrUrl(data.dataUrl);
      } catch (err) {
        console.error("Warp generation failed", err);
      } finally {
        setLoading(false);
      }
    };

    generateWarp();
  }, [game, slot]);

  if (!game) return null;

  return (
    <Dialog open={!!game} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-8 bg-[#0c0c0c] border-white/10 text-white">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center">
            <QrCode className="size-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Warp to Mobile</DialogTitle>
            <DialogDescription className="text-white/50 font-medium">
              Scan this code to continue playing <span className="text-white font-bold">{game.title}</span> on your mobile device.
            </DialogDescription>
          </div>

          <div className="relative aspect-square w-full max-w-[260px] bg-white rounded-3xl overflow-hidden flex items-center justify-center p-6 shadow-[0_0_50px_rgba(var(--primary),0.2)]">
            {loading ? (
              <Loader2 className="size-12 text-primary animate-spin" />
            ) : qrUrl ? (
              <img src={qrUrl} className="w-full h-full object-contain" alt="Warp Link QR Code" />
            ) : (
              <div className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Failed to generate</div>
            )}
          </div>

          <div className="w-full space-y-4">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4 text-left">
                <div className="size-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                   <Wifi className="size-5" />
                </div>
                <div>
                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/30">Step 1</div>
                   <div className="text-xs font-bold">Connect to local Wi-Fi</div>
                </div>
             </div>
             
             <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4 text-left">
                <div className="size-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                   <Smartphone className="size-5" />
                </div>
                <div>
                   <div className="text-[10px] font-mono uppercase tracking-widest text-white/30">Step 2</div>
                   <div className="text-xs font-bold">Open Camera & Scan</div>
                </div>
             </div>
          </div>

          <Button 
            onClick={onClose} 
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase tracking-widest"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
