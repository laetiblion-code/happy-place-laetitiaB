import { useMemo } from "react";
import { AttachmentLink } from "@/components/attachment-link";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { buttonVariants } from "@/components/ui/button";
import { delaiTexte, type Submission } from "@/lib/dashboard";
import { initialesDe } from "@/lib/noms";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Demandes à traiter (manager et admin) : une carte par demande, les plus anciennes d'abord. */
export function DemandesATraiter({
  items,
  error,
  pending,
  changes,
  validant,
  onRead,
  onRefuser,
  onClarifier,
  onValider,
}: {
  items: Submission[] | undefined;
  error: boolean;
  /** Nombre de demandes à valider (même compte que la carte « Demandes en attente »). */
  pending: number;
  changes: Map<string, { changed_at: string }>;
  validant: boolean;
  onRead: (s: Submission) => void;
  onRefuser: (s: Submission) => void;
  onClarifier: (s: Submission) => void;
  onValider: (s: Submission) => void;
}) {
  // Plus anciennes d'abord : une demande qui attend depuis longtemps reste en tête
  const triees = useMemo(
    () => [...(items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [items],
  );

  return (
    <section
      aria-labelledby="titre-a-traiter"
      className="flex min-w-0 flex-col gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant pb-sm">
        <div className="min-w-0">
          <h2 id="titre-a-traiter" className="font-headline-sm text-headline-sm text-primary">
            Demandes à traiter
          </h2>
          <p className="font-label-sm text-sm text-on-surface-variant">
            Tri : Plus anciennes d'abord
          </p>
        </div>
        {pending > 0 && (
          <span className="rounded-full bg-tertiary-fixed px-sm py-[2px] font-label-sm text-label-sm tabular-nums text-on-tertiary-fixed">
            {`${pending} à valider`}
          </span>
        )}
      </div>

      {error && <p className="text-body-sm text-error">Les demandes sont indisponibles.</p>}
      {items && triees.length === 0 && (
        <p className="font-body-sm italic text-on-surface-variant">Aucune demande à traiter.</p>
      )}

      <ul className="flex flex-col gap-sm">
        {triees.map((s) => {
          const depuis = changes.get(s.id)?.changed_at ?? s.created_at;
          return (
            <li
              key={s.id}
              className="min-w-0 space-y-sm rounded-md border border-outline-variant bg-card p-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-sm">
                <div className="flex min-w-0 items-center gap-sm">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EDEBE6] font-label-sm font-semibold text-primary"
                  >
                    {initialesDe(s.author_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-body-md font-bold text-primary wrap-anywhere">
                      {s.author_name}
                    </p>
                    <p className="font-label-sm text-sm text-on-surface-variant wrap-anywhere">{`Collaborateur ${s.team}`}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="inline-flex min-h-7 items-center gap-xs rounded-full bg-[#F0D0BC] px-sm py-xs font-label-sm text-sm text-[#28282D]">
                    <Icon name="hourglass_empty" className="text-base" />
                    {`En attente chez toi depuis ${delaiTexte(depuis)}`}
                  </span>
                  <VisibilityChip visibility={s.visibility} />
                </div>
              </div>

              <div className="space-y-sm rounded-md bg-[#F5F4F1] p-sm">
                <CategoryChip category={s.category} />
                <p className="line-clamp-4 whitespace-pre-line font-body-md text-on-surface wrap-anywhere">
                  {`« ${s.content} »`}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
                  <button
                    type="button"
                    onClick={() => onRead(s)}
                    aria-haspopup="dialog"
                    aria-label={`Lire en entier la demande de ${s.author_name}`}
                    className="inline-flex min-h-11 items-center font-label-sm text-sm text-primary underline underline-offset-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Lire en entier
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-xs">
                <button
                  type="button"
                  onClick={() => onRefuser(s)}
                  aria-label={`Refuser la demande de ${s.author_name}`}
                  className={`${buttonVariants({ variant: "destructive" })} min-h-11`}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={() => onClarifier(s)}
                  aria-label={`Clarifier la demande de ${s.author_name}`}
                  className={`${buttonVariants({ variant: "secondary" })} min-h-11`}
                >
                  Clarifier
                </button>
                <button
                  type="button"
                  onClick={() => onValider(s)}
                  disabled={validant}
                  aria-label={`Valider la demande de ${s.author_name}`}
                  className={`${buttonVariants({ variant: "default" })} min-h-11`}
                >
                  Valider
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
