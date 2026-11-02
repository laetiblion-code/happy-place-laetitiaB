import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AttachmentLink } from "@/components/attachment-link";
import { Linkify } from "@/components/linkify";
import { CLARIFY_CATEGORY, StatusBadge } from "@/components/status-badge";
import { SubmissionHistory } from "@/components/manage/submission-history";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { DureeCourte } from "@/components/duree-courte";
import { ChipStatut, COULEUR_STATUT, LienBasBloc } from "@/components/chips";
import { buttonVariants } from "@/components/ui/button";
import { EXPORT_INFO_MES_DEMANDES } from "@/hooks/use-export-mes-demandes";
import {
  delaiTexte,
  fetchManagersMonEquipe,
  formatDateCourte,
  type ManagerEquipe,
  type Submission,
} from "@/lib/dashboard";
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

/** Managers de l'équipe d'une demande : « Kesha », « Kesha et Sophie », ou rien. */
function managersDeEquipe(team: string, managers: ManagerEquipe[]) {
  const cle = team.trim().toLowerCase();
  return managers.filter((m) => m.team.trim().toLowerCase() === cle);
}

/** Prénoms joints : « Kesha », « Kesha et Sophie ». */
function listePrenoms(managers: ManagerEquipe[]) {
  const prenoms = managers.map((m) => m.prenom);
  if (prenoms.length <= 1) return prenoms[0] ?? "";
  return `${prenoms.slice(0, -1).join(", ")} et ${prenoms[prenoms.length - 1]}`;
}

/**
 * « Mes demandes » (collaborateur). Le nom des managers vient de managers_de_mon_equipe() : prénom et nom
 * seulement, pour la seule équipe de la personne connectée. Aucun e-mail, aucun autre accès.
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
  const managersQuery = useQuery({
    queryKey: ["managers-mon-equipe"],
    queryFn: fetchManagersMonEquipe,
    retry: false,
  });
  const managers = managersQuery.data ?? [];
  const toutes = items ?? [];
  const visibles = deplie ? toutes : toutes.slice(0, APERCU);

  return (
    <section
      aria-labelledby="titre-mes-demandes"
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant pb-sm">
        <h2 id="titre-mes-demandes" className="font-headline-sm text-headline-sm text-primary">
          Mes demandes
        </h2>
        <button
          type="button"
          title={EXPORT_INFO_MES_DEMANDES}
          disabled={exporting}
          onClick={onExport}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Icon name="file_download" /> {exporting ? "Export en cours…" : "Exporter mes demandes (CSV)"}
        </button>
      </div>
      <div className="mb-md mt-md flex flex-wrap items-center justify-between gap-sm">
        <MyChips counts={counts} />
        <p className="font-label-sm text-sm text-on-surface-variant">Tri : Plus récentes d'abord</p>
      </div>

      {isError && <p className="text-body-sm text-error">Les demandes sont indisponibles.</p>}
      {items && toutes.length === 0 && (
        <p className="text-body-sm italic text-on-surface-variant">
          Tu n'as pas encore envoyé de demande.
        </p>
      )}

      <ul className="flex flex-col gap-sm">
        {visibles.map((s) => (
          <CarteDemande
            key={s.id}
            s={s}
            changes={changes}
            managers={managersDeEquipe(s.team, managers)}
            onRead={onRead}
          />
        ))}
      </ul>

      {toutes.length > APERCU && (
        <div className="mt-md">
          <LienBasBloc onClick={() => setDeplie((d) => !d)} align="centre">
            {deplie ? "Replier la liste" : `Voir toutes mes demandes (${toutes.length})`}
          </LienBasBloc>
        </div>
      )}
    </section>
  );
}

function CarteDemande({
  s,
  changes,
  managers,
  onRead,
}: {
  s: Submission;
  changes: Map<string, { new_status: string; changed_at: string }>;
  managers: ManagerEquipe[];
  onRead: (s: Submission) => void;
}) {
  const changement = changes.get(s.id)?.changed_at ?? s.created_at;
  const clarification = s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY;
  const enAttente = s.status === "en attente";
  // Prénoms affichés : « Kesha » ou « Kesha et Sophie ». Sans manager identifiable, « ton manager ».
  const prenoms = listePrenoms(managers);
  const qui = prenoms || "ton manager";
  const Qui = prenoms || "Ton manager";
  const pluriel = managers.length > 1;
  const envoi = managers.length
    ? `Envoyée à ${prenoms} (${pluriel ? "managers" : "manager"} ${s.team})`
    : `Envoyée au manager de l'équipe ${s.team}`;

  return (
    <li
      className={`min-w-0 space-y-sm overflow-hidden rounded-md border border-outline-variant bg-card p-sm ${clarification ? "border-l-4 border-l-[#C99695]" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <p className="min-w-0 font-body-md text-primary wrap-anywhere">{envoi}</p>
        <div className="flex flex-wrap items-center gap-xs">
          {enAttente ? (
            <ChipStatut icon="hourglass_empty" couleur={COULEUR_STATUT.sable}>
              En attente chez {managers.length ? prenoms : "ton manager"} depuis{" "}
              <DureeCourte iso={changement} />
            </ChipStatut>
          ) : (
            <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
          )}
          <VisibilityChip visibility={s.visibility} />
        </div>
      </div>

      <div className="flex flex-col gap-sm rounded-md bg-[#F5F4F1] p-sm">
        <div className="flex flex-wrap items-start gap-sm">
          <CategoryChip category={s.category} />
          <p className="min-w-0 flex-1 whitespace-pre-line font-body-md text-on-surface wrap-anywhere">
            {`« ${s.content} »`}
          </p>
        </div>
        <AttachmentLink path={s.attachment_path} name={s.attachment_name} />

        {clarification && (
          <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
            <p className="whitespace-pre-line">
              <strong>{`${Qui} :`}</strong> « <Linkify text={s.rejection_note ?? ""} /> »
            </p>
          </div>
        )}

        {s.status === "refusée" && !clarification && s.rejection_category && (
          <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
            <p className="whitespace-pre-line">
              <strong>{`Motif de ${qui} :`}</strong> {s.rejection_category}
              {s.rejection_note ? (
                <>
                  {". "}
                  <Linkify text={s.rejection_note} />
                </>
              ) : null}
            </p>
          </div>
        )}
        {/* Lire ma demande en entier : même place que dans « Demandes à traiter » */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRead(s)}
            aria-haspopup="dialog"
            aria-label={`Lire ma demande en entier, envoyée le ${formatDateCourte(s.created_at)}`}
            className="inline-flex min-h-11 items-center font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="underline underline-offset-2">Lire ma demande en entier</span>
          </button>
        </div>
      </div>

      {clarification && (
        <p className="flex items-start gap-xs font-label-sm text-sm text-on-surface-variant">
          <Icon name="hourglass_empty" className="text-base shrink-0" />
          <span>{`${Qui} attend ta réponse depuis ${delaiTexte(changement)}`}</span>
        </p>
      )}

      {s.status === "validée" && (
        <p className="font-label-sm text-sm text-[#1F6B38]">
          {`Validée par ${managers.length ? prenoms : "ton manager"} le ${formatDateCourte(changement)} · traitée en ${dureeEnJours(s.created_at, changement)}`}
        </p>
      )}

      {s.status === "refusée" && !clarification && (
        <p className="font-label-sm text-sm text-on-surface-variant">{`Refusée le ${formatDateCourte(changement)}`}</p>
      )}

      <div className="ml-auto">
        <SubmissionHistory submissionId={s.id} />
      </div>
    </li>
  );
}
