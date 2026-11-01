import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Linkify } from "@/components/linkify";
import { AttachmentLink } from "@/components/attachment-link";
import { formatExactDate } from "@/components/expandable-card";
import { SubmissionTags } from "@/components/submission-choices";
import type { Submission } from "@/lib/dashboard";
import { RejectionNote, StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";

/** Grande fenêtre de lecture d'une soumission (focus piégé, Échap, clic fond). */
export function SubmissionReader({
  submission: s,
  onClose,
  onReject,
  onApprove,
  approving,
}: {
  submission: Submission | null;
  onClose: () => void;
  onReject?: () => void;
  onApprove?: () => void;
  approving?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        {s && (
          <DialogPrimitive.Content
            className="fixed z-50 inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[min(48rem,calc(100vw-2rem))] h-dvh md:h-auto md:max-h-[85vh] flex flex-col rounded-lg bg-surface-container-lowest border border-outline shadow-lg focus:outline-none"
          >
            <div className="flex items-start justify-between gap-sm border-b border-outline-variant p-md">
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary wrap-anywhere">
                  {s.author_name}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="font-label-sm text-label-sm text-on-surface-variant">
                  <span className="inline-flex flex-wrap items-center gap-xs">
                    <span>{s.team}</span>
                    <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
                    <span>Soumise le {formatExactDate(s.created_at)}</span>
                  </span>
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Fermer"
                className="text-on-surface-variant hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-md space-y-md">
              <SubmissionTags category={s.category} visibility={s.visibility} />
              <p className="font-body-md text-body-md text-on-surface whitespace-pre-line wrap-anywhere">
                <Linkify text={s.content} />
              </p>
              <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
              {s.status === "refusée" && s.rejection_category && (
                <RejectionNote category={s.rejection_category} note={s.rejection_note} />
              )}
            </div>
            {(onReject || onApprove) && (
              <div className="flex gap-xs border-t border-outline-variant p-md">
                {onReject && (
                  <button
                    type="button"
                    onClick={onReject}
                    className={`${buttonVariants({ variant: "destructive" })} flex-1`}
                  >
                    Refuser
                  </button>
                )}
                {onApprove && (
                  <button
                    type="button"
                    disabled={approving}
                    onClick={onApprove}
                    className={`${buttonVariants({ variant: "default" })} flex-1`}
                  >
                    Valider
                  </button>
                )}
              </div>
            )}
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
