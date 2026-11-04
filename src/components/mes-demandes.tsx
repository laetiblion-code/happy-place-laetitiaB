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
import { CompleterDemande } from "@/components/completer-demande";
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
import { dureeEnJours, ilYaCourt } from "@/lib/noms";
import { EchangeDemande, useEchangeDemande } from "@/components/echange-demande";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Nombre de demandes affichées avant « Voir toutes mes demandes ». */
const APERCU = 4;
/** Identifiant du titre de la section : destination du focus après un envoi. */
const ID_TITRE = "titre-mes-demandes";

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

type Cible = { s: Submission; demandeur: string; attente: string };

/**
 * « Mes demandes » (collaborateur). Le nom des managers vient de managers_de_mon_equipe() : prénom et nom
 * seulement, pour la seule équipe de la personne connectée. Aucun e-mail, aucun autre accès.
 */
export function MesDemandes({
  items,
  isError,
  changes,
  counts,
  email,
  exporting,
  onExport,
  onRead,
  onNouvelle,
}: {
  items: Submission[] | undefined;
  isError: boolean;
  changes: Map<string, { new_status: string; changed_at: string }>;
  counts: MyCounts | undefined;
  /** Adresse de la personne connectée : ses actions s'affichent « toi » dans l'historique. */
  email: string;
  exporting: boolean;
  onExport: () => void;
  onRead: (s: Submission) => void;
  /** Ouvre le formulaire « Nouvelle demande » (état vide). */
  onNouvelle: () => void;
}) {
  const [deplie, setDeplie] = useState(false);
  const [cible, setCible] = useState<Cible | null>(null);
  const [annonce, setAnnonce] = useState("");
  const managersQuery = useQuery({
    queryKey: ["managers-mon-equipe"],
    queryFn: fetchManagersMonEquipe,
    retry: false,
  });
  const managers = managersQuery.data ?? [];
  const toutes = items ?? [];
  const visibles = deplie ? toutes : toutes.slice(0, APERCU);
  // Aucune demande (liste chargée) : pas d'export, pas de tri, pas de compteurs à zéro
  const aucune = items !== undefined && toutes.length === 0;

  return (
    <section
      aria-labelledby={ID_TITRE}
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant pb-sm">
        <h2
          id={ID_TITRE}
          tabIndex={-1}
          className="font-headline-sm text-headline-sm text-primary focus:outline-none"
        >
          Mes demandes
        </h2>
        {!aucune && (
          <button
            type="button"
            title={EXPORT_INFO_MES_DEMANDES}
            disabled={exporting}
            onClick={onExport}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Icon name="file_download" /> {exporting ? "Export en cours…" : "Exporter mes demandes (CSV)"}
          </button>
        )}
      </div>
      {!aucune && (
        <div className="mb-md mt-md flex flex-wrap items-center justify-between gap-sm">
          <MyChips counts={counts} />
          <p className="font-label-sm text-sm text-on-surface-variant">Tri : Plus récentes d'abord</p>
        </div>
      )}

      {/* Annonce des envois réussis (lecteurs d'écran) */}
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>

      {isError && <p className="text-body-sm text-error">Les demandes sont indisponibles.</p>}
      {aucune && (
        <div className="mb-md flex flex-col items-start gap-sm">
          <p className="min-w-0 text-body-md text-on-surface">
            Tu n'as pas encore envoyé de demande. Une question, une idée, un problème ?
          </p>
          <button
            type="button"
            onClick={onNouvelle}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Icon name="add" /> Nouvelle demande
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-sm">
        {visibles.map((s) => (
          <CarteDemande
            key={s.id}
            s={s}
            changes={changes}
            managers={managersDeEquipe(s.team, managers)}
            managersCharges={managersQuery.isSuccess}
            moi={email}
            onRead={onRead}
            onCompleter={(c) => setCible(c)}
          />
        ))}
      </ul>

      {cible && (
        <CompleterDemande
          submission={cible.s}
          demandeur={cible.demandeur}
          attente={cible.attente}
          onClose={() => setCible(null)}
          onEnvoyee={() => {
            setAnnonce(`Réponse envoyée à ${cible.attente}.`);
            setCible(null);
            // La fenêtre rend le focus au bouton, qui disparaît : le focus va au titre de la section
            setTimeout(() => document.getElementById(ID_TITRE)?.focus(), 0);
          }}
        />
      )}

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

/** « 2 nov. » : date courte pour les libellés accessibles. */
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
function dateCourteLongue(iso: string) {
  return dateCourte.format(new Date(iso));
}

function CarteDemande({
  s,
  changes,
  managers,
  managersCharges,
  moi,
  onRead,
  onCompleter,
}: {
  s: Submission;
  changes: Map<string, { new_status: string; changed_at: string }>;
  managers: ManagerEquipe[];
  /** Liste des managers chargée : sans manager, l'historique dit « chez l'admin ». */
  managersCharges: boolean;
  moi: string;
  onRead: (s: Submission) => void;
  onCompleter: (c: Cible) => void;
}) {
  const changement = changes.get(s.id)?.changed_at ?? s.created_at;
  const clarification = s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY;
  const enAttente = s.status === "en attente";
  // Attente de plus de trois jours : chip en rouge
  const attenteLongue = Date.now() - new Date(changement).getTime() > 3 * 86_400_000;
  // Prénoms affichés : « Kesha » ou « Kesha et Sophie ». Sans manager identifiable, « ton manager ».
  const prenoms = listePrenoms(managers);
  const qui = prenoms || "ton manager";
  const pluriel = managers.length > 1;
  const envoi = managers.length
    ? `Envoyée à ${prenoms} (${pluriel ? "managers" : "manager"} ${s.team})`
    : `Envoyée au manager de l'équipe ${s.team}`;

  // Texte de la demande sans les réponses, question et réponse les plus récentes (voir echange-demande)
  const echange = useEchangeDemande(s, moi);
  // Qui a demandé la clarification : seulement cette personne (pas tous les managers)
  const Demandeur = echange.question?.nom ?? "Ton manager";

  return (
    <li
      className={`min-w-0 space-y-sm overflow-hidden rounded-md border border-outline-variant bg-card p-sm ${clarification ? "border-l-4 border-l-[#C99695]" : ""}`}
    >
      {/* En-tête : où la demande est envoyée, et où et depuis quand elle attend (ou son statut) */}
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <p className="min-w-0 font-body-md font-bold text-primary wrap-anywhere">{envoi}</p>
        {enAttente ? (
          <ChipStatut
            icon="hourglass_empty"
            couleur={attenteLongue ? COULEUR_STATUT.rouge : COULEUR_STATUT.sable}
          >
            En attente chez {managers.length ? prenoms : "ton manager"} depuis{" "}
            <DureeCourte iso={changement} />
          </ChipStatut>
        ) : (
          <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
        )}
      </div>

      {/* Corps : texte sur trois lignes, « Voir », pièce jointe, échange et motif dans l'encadré clair */}
      <div className="flex flex-col gap-sm rounded-md border border-[#E4E2DD] bg-[#FAF9F7] p-sm">
        <p className="line-clamp-3 whitespace-pre-line font-body-md text-on-surface wrap-anywhere">
          {`« ${echange.texte} »`}
        </p>
        <div className="-mt-2 flex flex-wrap items-center gap-sm">
          <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
          <button
            type="button"
            onClick={() => onRead(s)}
            aria-haspopup="dialog"
            aria-label={`Voir plus d'infos sur ma demande du ${dateCourteLongue(s.created_at)}`}
            className="ml-auto inline-flex min-h-11 items-center font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="underline underline-offset-2">Voir</span>
          </button>
        </div>

        <EchangeDemande echange={echange} />

        {s.status === "refusée" && !clarification && s.rejection_category && (
          <div className="border border-[#E4E2DD] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
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

        {clarification && (
          <div className="flex flex-wrap items-center justify-end gap-sm">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() =>
                onCompleter({ s, demandeur: Demandeur, attente: prenoms || "ton manager" })
              }
              className={buttonVariants({ variant: "default" })}
            >
              <Icon name="edit" className="text-[18px]" />
              Compléter ma demande
            </button>
          </div>
        )}
      </div>

      {clarification && (
        <p className="flex items-start gap-xs font-label-sm text-sm text-on-surface-variant">
          <Icon name="hourglass_empty" className="text-base shrink-0" />
          <span>{`${Demandeur} attend ta réponse depuis ${delaiTexte(changement)}`}</span>
        </p>
      )}

      {enAttente && echange.reponse && (
        <p className="flex items-start gap-xs font-label-sm text-sm text-on-surface-variant">
          <Icon name="hourglass_empty" className="text-base shrink-0" />
          <span>{`Réponse envoyée ${ilYaCourt(echange.reponse.quand)} · en attente chez ${prenoms || "ton manager"}`}</span>
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

      {/* Pied : étiquette de type et pilule de visibilité, « Historique » replié à droite */}
      <div className="flex flex-wrap items-center justify-between gap-sm border-t border-outline-variant pt-sm">
        <div className="flex flex-wrap items-center gap-xs">
          {s.category && <CategoryChip category={s.category} />}
          <VisibilityChip visibility={s.visibility} />
        </div>
        <SubmissionHistory
          submissionId={s.id}
          moi={moi}
          attenteChez={managersCharges ? prenoms || "l'admin" : undefined}
          contenu={s.content}
        />
      </div>
    </li>
  );
}
