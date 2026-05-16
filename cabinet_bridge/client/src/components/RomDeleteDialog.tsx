import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  romId: number;
  romTitle: string;
  /** Called after a successful delete so the parent can navigate away or update state */
  onDeleted?: () => void;
  /** Render as icon-only button (default: false) */
  iconOnly?: boolean;
}

export function RomDeleteDialog({ romId, romTitle, onDeleted, iconOnly = false }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/roms/${romId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(body.message ?? "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      toast({ title: "ROM deleted", description: `${romTitle} has been removed.` });
      setOpen(false);
      onDeleted?.();
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${romTitle}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Delete ROM
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete ROM?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{romTitle}</strong> and its file from storage.
            Save states and play history will also be lost. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
