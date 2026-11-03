import { useMemo } from "react";
import { AttachmentLink } from "@/components/attachment-link";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatut, COULEUR_STATUT, CLASSE_BOUTON_CARTE } from "@/components/chips";
import { cn } from "@/lib/utils";
import { type Submission } from "@/lib/dashboard";
import { DureeCourte } from "@/components/duree-courte";
import { initialesDe } from "@/lib/noms";

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
          <span className="rounded-full bg-tertiary-fixed px-sm py-[2px] font-label-sm text-sm tabular-nums text-on-tertiary-fixed">
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
                  <ChipStatut icon="hourglass_empty" couleur={COULEUR_STATUT.sable}>
                    Attend chez toi depuis <DureeCourte iso={depuis} />
                  </ChipStatut>
                  <VisibilityChip visibility={s.visibility} />
                </div>
              </div>

              <div className="flex flex-col gap-sm rounded-md border border-[#E4E2DD] bg-[#FAF9F7] p-sm">
                {/* Étiquette à gauche (taille fixe) ; le texte occupe la colonne de droite */}
                <div className="flex items-start gap-sm">
                  <span className="shrink-0">
                    <CategoryChip category={s.category} />
                  </span>
                  <p className="line-clamp-4 min-w-0 flex-1 whitespace-pre-line font-body-md text-on-surface wrap-anywhere">
                    {`« ${s.content} »`}
                  </p>
                </div>
                {/* Voir tout : à droite, juste sous le texte. La zone de 44 px dépasse en bas de l'encadré
                    (-mb-3) pour que la marge sous « Voir tout » soit la même que la marge au-dessus de la chip. */}
                <div className="-mt-4 -mb-3 flex flex-wrap items-center gap-sm">
                  <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
                  <button
                    type="button"
                    onClick={() => onRead(s)}
                    aria-haspopup="dialog"
                    aria-label={`Voir toute la demande de ${s.author_name}`}
                    className="ml-auto inline-flex min-h-11 items-center font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="underline underline-offset-2">Voir tout</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-xs">
                <button
                  type="button"
                  onClick={() => onRefuser(s)}
                  aria-label={`Refuser la demande de ${s.author_name}`}
                  className={cn(buttonVariants({ variant: "destructive" }), CLASSE_BOUTON_CARTE)}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={() => onClarifier(s)}
                  aria-label={`Clarifier la demande de ${s.author_name}`}
                  className={cn(buttonVariants({ variant: "secondary" }), CLASSE_BOUTON_CARTE)}
                >
                  Clarifier
                </button>
                <button
                  type="button"
                  onClick={() => onValider(s)}
                  disabled={validant}
                  aria-label={`Valider la demande de ${s.author_name}`}
                  className={cn(buttonVariants({ variant: "default" }), CLASSE_BOUTON_CARTE)}
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
