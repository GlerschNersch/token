import React, { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle, 
  Upload, 
  Loader2, 
  AlertCircle,
  FileCode,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface BiosStatus {
  filename: string;
  exists: boolean;
}

type BiosData = Record<string, BiosStatus[]>;

export function BiosManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: biosData, isLoading } = useQuery<BiosData>({
    queryKey: ["/api/bios"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, filename }: { file: File; filename: string }) => {
      const res = await fetch("/api/bios/upload", {
        method: "POST",
        headers: {
          "x-bios-filename": encodeURIComponent(filename),
          "Content-Type": "application/octet-stream",
        },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bios"] });
      toast({
        title: "BIOS Uploaded",
        description: "The system firmware has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    },
    onSettled: () => {
      setUploading(null);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, expectedFilename: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase() !== expectedFilename.toLowerCase()) {
      toast({
        variant: "destructive",
        title: "Filename Mismatch",
        description: `Expected '${expectedFilename}', but got '${file.name}'. Please rename the file and try again.`,
      });
      return;
    }

    setUploading(expectedFilename);
    uploadMutation.mutate({ file, filename: expectedFilename });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg border border-accent/20 bg-accent/5 flex gap-3">
        <AlertCircle className="size-5 text-accent shrink-0 mt-0.5" />
        <div className="text-sm text-accent/90 leading-relaxed">
          Some systems (like PS1, PS2, and Saturn) require original firmware (BIOS) files to run. 
          Upload the specific files listed below to enable support for these consoles. 
          <strong> Filenames must match exactly.</strong>
        </div>
      </div>

      <div className="grid gap-4">
        {biosData && Object.entries(biosData).map(([core, files]) => (
          <div key={core} className="p-5 rounded-xl border border-border bg-sidebar/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-display font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                <FileCode className="size-4 text-primary" />
                {core.toUpperCase()} Core
              </div>
            </div>

            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.filename} className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/50">
                  <div className="flex items-center gap-3">
                    {file.exists ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    <span className="font-mono text-xs text-foreground font-semibold">
                      {file.filename}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${file.exists ? "text-green-500/70" : "text-destructive/70"}`}>
                      {file.exists ? "Installed" : "Missing"}
                    </span>
                    <div className="relative">
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => handleFileChange(e, file.filename)}
                        disabled={uploading === file.filename}
                        title={`Upload ${file.filename}`}
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 gap-2 font-mono text-[10px] uppercase tracking-wider"
                        disabled={uploading === file.filename}
                      >
                        {uploading === file.filename ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Upload className="size-3" />
                        )}
                        {file.exists ? "Replace" : "Upload"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
