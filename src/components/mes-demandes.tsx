import { useState } from "react";
import { AttachmentLink } from "@/components/attachment-link";
import { Linkify } from "@/components/linkify";
import { CLARIFY_CATEGORY, StatusBadge } from "@/components/status-badge";
import { SubmissionHistory } from "@/components/manage/submission-history";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { buttonVariants } from "@/components/ui/button";
import { EXPORT_INFO_MES_DEMANDES } from "@/hooks/use-export-mes-demandes";
import { delaiTexte, formatDateCourte, type Submission } from "@/lib/dashboard";
import type { MyCounts } from "@/lib/home-counts";
import { MyChips } from "@/components/home-counters";
import { dureeEnJours } from "@/lib/noms";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Nombre de demandes affichées avant « Voir toutes mes demandes ». */
const APERCU = 4;

/**
 * « Mes demandes » (collaborateur). Le nom du manager n'est pas lisible par un collaborateur (règles d'accès) :
 * la carte dit « le manager de l'équipe » et n'ajoute aucun accès.
 */
export function MesDemandes({
  items,
  isError,
  changes,
  counts,
  exporting,
  onExport,
  onRead,
}: {
  items: Submission[] | undefined;
  isError: boolean;
  changes: Map<string, { new_status: string; changed_at: string }>;
  counts: MyCounts | undefined;
  exporting: boolean;
  onExport: () => void;
  onRead: (s: Submission) => void;
}) {
  const [deplie, setDeplie] = useState(false);
  const toutes = items ?? [];
  const visibles = deplie ? toutes : toutes.slice(0, APERCU);

  return (
    <section
      aria-labelledby="titre-mes-demandes"
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <h2
        id="titre-mes-demandes"
        className="border-b border-outline-variant pb-sm font-headline-sm text-headline-sm text-primary"
      >
        Mes demandes
      </h2>
      <div className="mb-md mt-md flex flex-wrap items-center justify-between gap-sm">
        <MyChips counts={counts} />
        <div className="flex flex-wrap items-center gap-sm">
          <button
            type="button"
            title={EXPORT_INFO_MES_DEMANDES}
            disabled={exporting}
            onClick={onExport}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Icon name="file_download" />{" "}
            {exporting ? "Export en cours…" : "Exporter mes demandes (CSV)"}
          </button>
          <p className="font-label-sm text-sm text-on-surface-variant">
            Tri : Plus récentes d'abord
          </p>
        </div>
      </div>

      {isError && <p className="text-body-sm text-error">Les demandes sont indisponibles.</p>}
      {items && toutes.length === 0 && (
        <p className="text-body-sm italic text-on-surface-variant">
          Tu n'as pas encore envoyé de demande.
        </p>
      )}

      <ul className="flex flex-col gap-sm">
        {visibles.map((s) => (
          <CarteDemande key={s.id} s={s} changes={changes} onRead={onRead} />
        ))}
      </ul>

      {toutes.length > APERCU && (
        <button
          type="button"
          onClick={() => setDeplie((d) => !d)}
          aria-expanded={deplie}
          className="mt-md inline-flex min-h-11 items-center font-label-sm text-sm text-primary underline underline-offset-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {deplie ? "Replier la liste" : `Voir toutes mes demandes (${toutes.length})`}
        </button>
      )}
    </section>
  );
}

function CarteDemande({
  s,
  changes,
  onRead,
}: {
  s: Submission;
  changes: Map<string, { new_status: string; changed_at: string }>;
  onRead: (s: Submission) => void;
}) {
  const changement = changes.get(s.id)?.changed_at ?? s.created_at;
  const clarification = s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY;
  const enAttente = s.status === "en attente";

  return (
    <li className="min-w-0 space-y-sm overflow-hidden rounded-md border border-outline-variant bg-card p-sm">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <p className="min-w-0 font-body-md text-primary wrap-anywhere">
          {`Envoyée au manager de l'équipe ${s.team}`}
        </p>
        <div className="flex flex-wrap items-center gap-xs">
          {enAttente ? (
            <span className="inline-flex min-h-7 items-center gap-xs rounded-md bg-[#F0D0BC] px-xs py-[2px] font-label-sm text-label-sm font-semibold text-[#28282D]">
              <Icon name="hourglass_empty" className="text-sm" />
              {`En attente chez ton manager depuis ${delaiTexte(changement)}`}
            </span>
          ) : (
            <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
          )}
          <VisibilityChip visibility={s.visibility} />
        </div>
      </div>

      <div className="space-y-sm rounded-md bg-[#F5F4F1] p-sm">
        <CategoryChip category={s.category} />
        <p className="whitespace-pre-line font-body-md text-on-surface wrap-anywhere">{`« ${s.content} »`}</p>
        <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
      </div>

      {clarification && (
        <div className="space-y-xs border-l-4 border-[#C99695] pl-sm">
          <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
            <p className="whitespace-pre-line">
              <strong>Ton manager :</strong> « <Linkify text={s.rejection_note ?? ""} /> »
            </p>
          </div>
          <p className="font-label-sm text-sm text-on-surface-variant">
            {`Ton manager attend ta réponse depuis ${delaiTexte(changement)}`}
          </p>
        </div>
      )}

      {s.status === "validée" && (
        <p className="font-label-sm text-sm text-[#1F6B38]">
          {`Validée par ton manager le ${formatDateCourte(changement)} · traitée en ${dureeEnJours(s.created_at, changement)}`}
        </p>
      )}

      {s.status === "refusée" && !clarification && s.rejection_category && (
        <div className="space-y-xs">
          <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
            <p className="whitespace-pre-line">
              <strong>Motif de ton manager :</strong> {s.rejection_category}
              {s.rejection_note ? (
                <>
                  {". "}
                  <Linkify text={s.rejection_note} />
                </>
              ) : null}
            </p>
          </div>
          <p className="font-label-sm text-sm text-on-surface-variant">{`Refusée le ${formatDateCourte(changement)}`}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onRead(s)}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 items-center font-label-sm text-sm text-primary underline underline-offset-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Lire ma demande en entier
      </button>
      <SubmissionHistory submissionId={s.id} />
    </li>
  );
}
