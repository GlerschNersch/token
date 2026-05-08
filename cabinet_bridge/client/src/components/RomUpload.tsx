import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SYSTEMS, type SystemId, formatRomSize } from "@/data/library";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UploadedRom } from "@shared/schema";
import { FileArchive, Upload, X } from "lucide-react";

type UploadLimits = {
  maxUploadMb: number;
  maxUploadBytes: number;
  allowedExtensions: Record<string, string[]>;
};

interface RomUploadProps {
  /**
   * When provided, uploads are pinned to this system and the picker is hidden.
   * When omitted, the user must select a system before uploading.
   */
  system?: SystemId;
  /** Visual variant — "card" matches the Settings dropzone, "inline" is tighter for system pages. */
  variant?: "card" | "inline";
}

export function RomUpload({ system: fixedSystem, variant = "card" }: RomUploadProps) {
  const [pickedSystem, setPickedSystem] = useState<string>(fixedSystem ?? "");
  const system = fixedSystem ?? pickedSystem;
  const systemMeta = SYSTEMS.find((s) => s.id === system);
  const [favorite, setFavorite] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: limits } = useQuery<UploadLimits>({
    queryKey: ["/api/upload-limits"],
  });
  const maxUploadBytes = limits?.maxUploadBytes ?? 2048 * 1024 * 1024;
  const maxUploadMb = limits?.maxUploadMb ?? 2048;
  const oversize = files.find((f) => f.size > maxUploadBytes);

  const mergeFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!system) throw new Error("Choose a console first.");
      if (files.length === 0) throw new Error("Choose one or more ROM files first.");
      const tooBig = files.find((f) => f.size > maxUploadBytes);
      if (tooBig) {
        throw new Error(
          `${tooBig.name} is ${formatRomSize(tooBig.size)}, which exceeds the ${maxUploadMb} MB upload limit. Raise max_upload_mb in the add-on options or set CABINET_MAX_UPLOAD_MB.`,
        );
      }
      const uploaded: UploadedRom[] = [];
      for (const romFile of files) {
        const res = await apiRequest(
          "POST",
          `/api/roms/upload?system=${encodeURIComponent(system)}&favorite=${favorite ? "1" : "0"}`,
          romFile,
          {
            headers: {
              "Content-Type": romFile.type || "application/octet-stream",
              "X-ROM-Filename": encodeURIComponent(romFile.name),
            },
          },
        );
        uploaded.push((await res.json()) as UploadedRom);
      }
      return uploaded;
    },
    onSuccess: async () => {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/roms"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/collections"] }),
      ]);
    },
  });

  const targetLabel = systemMeta ? `${systemMeta.shortName} ROMs` : "ROMs";
  const headingCopy = fixedSystem && systemMeta
    ? `Upload ${systemMeta.shortName} ROMs`
    : "Upload ROMs";
  const helperCopy = fixedSystem && systemMeta
    ? `Saved as ${systemMeta.name}. .nes .sfc .gba .z64 .iso .zip .7z — up to ${maxUploadMb} MB each.`
    : `Pick a console, then drop files. .nes .sfc .gba .z64 .iso .zip .7z — up to ${maxUploadMb} MB each.`;

  return (
    <div
      className={`rounded-lg border border-border bg-background/40 ${variant === "inline" ? "p-3 sm:p-4" : "p-4"} space-y-3`}
      data-testid="rom-upload"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="font-display text-sm font-semibold tracking-tight">{headingCopy}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{helperCopy}</p>
      </div>

      {/* ── System picker (hidden when system is fixed) ─────────────────────── */}
      {!fixedSystem ? (
        <select
          value={pickedSystem}
          onChange={(e) => setPickedSystem(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="select-rom-system"
        >
          <option value="">Select a console…</option>
          {SYSTEMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shortName} — {s.name}
            </option>
          ))}
        </select>
      ) : null}

      {/* ── Compact dropzone ────────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          mergeFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        data-testid="input-rom-file"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          mergeFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`flex items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
          dragActive
            ? "border-accent bg-accent/10"
            : "border-border bg-background/40 hover:border-accent/60 hover:bg-accent/5"
        }`}
        data-testid="dropzone-rom-file"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="font-mono uppercase tracking-wider shrink-0"
          data-testid="button-browse-rom-files"
        >
          Browse {targetLabel}
        </Button>
        <p className="text-[11px] text-muted-foreground hidden sm:block">
          or drag &amp; drop here
        </p>
      </div>

      {/* ── Selected file list ───────────────────────────────────────────────── */}
      {files.length > 0 ? (
        <div className="rounded-md border border-border bg-card/50 p-3" data-testid="text-selected-rom">
          <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <FileArchive className="size-4 text-accent shrink-0" />
              <span className="truncate">
                {files.length} file{files.length === 1 ? "" : "s"} selected ·{" "}
                {formatRomSize(files.reduce((sum, item) => sum + item.size, 0))}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setFiles([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground shrink-0"
              data-testid="button-clear-rom-files"
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground">
            {files.map((item) => (
              <li key={`${item.name}-${item.size}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{item.name} · {formatRomSize(item.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((f) => !(f.name === item.name && f.size === item.size)))}
                  aria-label={`Remove ${item.name}`}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  data-testid={`button-remove-rom-file-${item.name}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Error / success banners ──────────────────────────────────────────── */}
      {oversize ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          data-testid="warn-rom-upload-size"
        >
          {oversize.name} is {formatRomSize(oversize.size)}, larger than the {maxUploadMb} MB limit.
          Raise <code>max_upload_mb</code> in add-on options and restart.
        </div>
      ) : null}

      {upload.isError ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          data-testid="error-rom-upload"
        >
          {(upload.error as Error).message}
        </div>
      ) : null}

      {upload.isSuccess ? (
        <div
          className="rounded-md border border-status-online/40 bg-status-online/10 px-3 py-2 text-xs text-status-online"
          data-testid="success-rom-upload"
        >
          {fixedSystem && systemMeta
            ? `${systemMeta.shortName} ROMs added — they should appear in the grid below.`
            : "ROM upload complete. Switch to that system's page to launch newly added games."}
        </div>
      ) : null}

      {/* ── Footer: favorite toggle + upload button ──────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          <Switch
            id="rom-favorite"
            checked={favorite}
            onCheckedChange={(checked) => setFavorite(!!checked)}
            data-testid="switch-rom-favorite"
          />
          <Label htmlFor="rom-favorite" className="text-sm cursor-pointer">
            Add to Favorites
          </Label>
        </div>
        <Button
          onClick={() => upload.mutate()}
          disabled={!system || files.length === 0 || upload.isPending}
          className="font-mono uppercase tracking-wider shrink-0"
          data-testid="button-upload-rom"
        >
          <Upload className="size-4 mr-2" />
          {upload.isPending
            ? `Uploading ${files.length}\u2026`
            : files.length > 1
            ? `Upload ${files.length} ${systemMeta ? systemMeta.shortName + " " : ""}ROMs`
            : `Upload ${systemMeta ? systemMeta.shortName + " " : ""}ROM`}
        </Button>
      </div>
    </div>
  );
}
