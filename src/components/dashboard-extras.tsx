import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { formatExactDate } from "@/components/expandable-card";
import { fetchResolvedBlockers } from "@/lib/dashboard";

/** Fenêtre « Archive des alertes opérationnelles » (lecture seule, statut RÉSOLU). */
export function BlockerArchive({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["blockers", "resolved"],
    queryFn: fetchResolvedBlockers,
    enabled: open,
    retry: false,
  });
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed z-50 inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[min(48rem,calc(100vw-2rem))] h-dvh md:h-auto md:max-h-[85vh] flex flex-col rounded-lg bg-surface-container-lowest border border-outline shadow-lg focus:outline-none">
          <div className="flex items-start justify-between gap-sm border-b border-outline-variant p-md">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary">
                Archive des alertes opérationnelles
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-label-sm text-label-sm text-on-surface-variant">
                Points résolus, du plus récent au plus ancien
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="text-on-surface-variant hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                close
              </span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-md space-y-sm">
            {q.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
            {q.isError && <p className="text-body-sm text-error">L'archive est indisponible.</p>}
            {q.data?.length === 0 && (
              <p className="text-body-sm text-on-surface-variant italic">
                Aucun point bloquant résolu.
              </p>
            )}
            {q.data?.map((b) => (
              <div
                key={b.id}
                className="rounded-lg bg-card border border-outline-variant p-sm min-w-0"
              >
                <p className="font-body-md text-primary font-bold wrap-anywhere">{b.title}</p>
                {b.description && (
                  <p className="text-body-sm text-on-surface-variant whitespace-pre-line wrap-anywhere">
                    {b.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-sm mt-xs text-[11px] font-label-sm">
                  <span className="bg-surface-container-highest px-xs py-0.5">{b.department}</span>
                  <span className="text-on-surface-variant">Sévérité : {b.severity}</span>
                  <span className="text-on-surface-variant">
                    Mis à jour le {formatExactDate(b.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
