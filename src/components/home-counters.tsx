import type { ReactNode } from "react";
import { formatNumberFr, formatObjectif } from "@/lib/dashboard";
import { Unite } from "@/components/duree-courte";
import { ChipStatut, LienBasBloc, COULEUR_STATUT } from "@/components/chips";
import { texteAttenteAncienne } from "@/lib/duree-libelles";
import {
  noun,
  plural,
  type AlertCounts,
  type DelaiValidation,
  type DraftCounts,
  type MyCounts,
  type PublicationActus,
  type ReviewCounts,
} from "@/lib/home-counts";
import { etatObjectif, OBJECTIFS_TRIMESTRE, type EtatObjectif } from "@/lib/objectifs";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Chip de statut d'une carte. `label` : texte complet (lecteurs d'écran) ; `visible` : version affichée. */
function Chip({
  icon,
  label,
  visible,
  className,
}: {
  icon: string;
  label: string;
  visible?: ReactNode;
  className: string;
}) {
  return (
    <ChipStatut icon={icon} label={label} couleur={className}>
      {visible ?? label}
    </ChipStatut>
  );
}

const SAND = COULEUR_STATUT.sable;
const ROSE = COULEUR_STATUT.rose;
const GREEN = COULEUR_STATUT.vert;
const RED = COULEUR_STATUT.rouge;

/** Titre de carte : Bodoni Moda 20 px (les autres titres de page restent en 24 px et plus). */
function StatCard({
  title,
  icon,
  ariaLabel,
  children,
  footer,
}: {
  title: string;
  icon: string;
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="flex flex-col gap-sm rounded-lg border border-[#CDCDD1] bg-white p-md"
    >
      <div className="flex items-start justify-between gap-sm">
        <h2
          className="font-['Bodoni_Moda',Georgia,serif] text-[20px] font-medium leading-snug text-primary"
        >
          {title}
        </h2>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F5D5D4] text-primary">
          <Icon name={icon} />
        </span>
      </div>
      <div className="flex flex-col gap-xs">{children}</div>
      {footer && <div className="mt-auto pt-xs">{footer}</div>}
    </section>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-xs font-body-md text-on-surface">
      <span className="text-[40px] font-semibold leading-none tabular-nums">{value}</span>
      <span className="text-body-md">{label}</span>
    </p>
  );
}

/** Ligne d'objectif : icône et texte, sous un trait séparateur. */
function LigneObjectif({ icon, texte }: { icon: string; texte: ReactNode }) {
  return (
    <p className="flex items-start gap-xs font-label-sm text-sm text-[#68686D]">
      <Icon name={icon} className="text-base shrink-0" />
      <span>{texte}</span>
    </p>
  );
}

const ETAT_STYLE: Record<EtatObjectif, { icon: string; classe: string; accord: string }> = {
  atteint: { icon: "check_circle", classe: "text-[#1F6B38]", accord: "atteint" },
  presque: { icon: "info", classe: "text-[#68686D]", accord: "presque atteint" },
  non: { icon: "trending_down", classe: "text-[#A81E25]", accord: "non atteint" },
};

/** État d'un objectif : icône et texte (jamais la couleur seule). */
function LigneEtat({ etat, objectif }: { etat: EtatObjectif; objectif: ReactNode }) {
  const style = ETAT_STYLE[etat];
  return (
    <p className={`flex items-start gap-xs font-label-sm text-sm font-semibold ${style.classe}`}>
      <Icon name={style.icon} className="text-base shrink-0" />
      <span>
        Objectif {objectif} {style.accord}
      </span>
    </p>
  );
}

/** Pied de carte : trait séparateur, puis les lignes d'objectif. */
function PiedObjectif({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-xs border-t border-[#CDCDD1] pt-sm">{children}</div>;
}

/** Délai de validation (admin : cabinet ; manager : ses équipes), avec son état face à l'objectif. */
function PiedDelai({
  isAdmin,
  delai,
}: {
  isAdmin: boolean;
  delai: DelaiValidation | null | undefined;
}) {
  if (delai === undefined) return null;
  if (delai === null) {
    return (
      <PiedObjectif>
        <p className="font-label-sm text-sm text-on-surface-variant">
          Pas encore de demande traitée sur 30 jours
        </p>
      </PiedObjectif>
    );
  }
  const { delaiValidationJours } = OBJECTIFS_TRIMESTRE;
  const jours = formatNumberFr(delai.jours, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Accord : moins de 2 jours au singulier (« 1,4 j » pour la lecture : « 1,4 jour »), à partir de 2 au pluriel
  const pluriel = delai.jours >= 2;
  const libelle = isAdmin ? "Délai de validation du cabinet sur " : "Ton délai de validation sur ";
  const etat = etatObjectif(delai.jours, delaiValidationJours, "plusBas");
  const objectif = (
    <>
      de moins de{" "}
      <Unite valeur={String(delaiValidationJours)} unite="j" pluriel={delaiValidationJours >= 2} />
    </>
  );
  return (
    <PiedObjectif>
      <p className="font-label-sm text-sm text-[#68686D]">
        {libelle}
        <Unite valeur="30" unite="j" pluriel />
        {" : "}
        <span className="inline-block rounded-[4px] bg-[#EDEBE6] px-xs font-semibold text-[#28282D]">
          <Unite valeur={jours} unite="j" pluriel={pluriel} />
        </span>
      </p>
      <LigneEtat etat={etat} objectif={objectif} />
    </PiedObjectif>
  );
}

/**
 * Taux de publication des actualités créées dans les 30 derniers jours : tout le cabinet pour l'admin,
 * ses propres actualités pour le manager.
 */
function PiedActus({ actus }: { actus: PublicationActus | undefined }) {
  if (!actus) return null;
  if (actus.commencees === 0) {
    return (
      <PiedObjectif>
        <p className="font-label-sm text-sm text-on-surface-variant">
          Aucune actualité commencée en 30 j
        </p>
      </PiedObjectif>
    );
  }
  const pourcentage = Math.round((100 * actus.publiees) / actus.commencees);
  const etat = etatObjectif(pourcentage, OBJECTIFS_TRIMESTRE.tauxPublicationActus, "plusHaut");
  return (
    <PiedObjectif>
      <p className="font-label-sm text-sm text-[#68686D]">
        {`${plural(actus.publiees, "actu publiée", "actus publiées")} sur ${formatNumberFr(actus.commencees)} commencée${actus.commencees > 1 ? "s" : ""} en 30 j : `}
        <span className="inline-block rounded-[4px] bg-[#EDEBE6] px-xs font-semibold text-[#28282D]">
          {formatObjectif(pourcentage, "%")}
        </span>
      </p>
      <LigneEtat
        etat={etat}
        objectif={`de ${formatObjectif(OBJECTIFS_TRIMESTRE.tauxPublicationActus, "%")}`}
      />
    </PiedObjectif>
  );
}

/** Trois cartes du haut de page pour le manager et l'admin. */
export function ManagerCards({
  isAdmin,
  review,
  drafts,
  alerts,
  delai,
  actus,
}: {
  isAdmin: boolean;
  review: ReviewCounts | undefined;
  drafts: DraftCounts | undefined;
  alerts: AlertCounts | undefined;
  delai: DelaiValidation | null | undefined;
  actus: PublicationActus | undefined;
}) {
  const pending = review?.pending ?? 0;
  const old = review?.pendingOverThreeDays ?? 0;
  const clarify = review?.toClarify ?? 0;
  const draftCount = drafts?.drafts ?? 0;
  const draftsMine = drafts?.draftsMine ?? 0;
  const alertTotal = alerts?.open ?? 0;
  const texteOld = texteAttenteAncienne(old, formatNumberFr, 3);
  const parts = [
    alerts?.ouverte ? plural(alerts.ouverte, "ouverte", "ouvertes") : null,
    alerts?.enCours ? `${formatNumberFr(alerts.enCours)} en cours` : null,
    alerts?.surveillance ? `${formatNumberFr(alerts.surveillance)} en surveillance` : null,
  ].filter((p): p is string => p !== null);

  return (
    <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
      <StatCard
        title="Demandes en attente"
        icon="pending_actions"
        ariaLabel={plural(pending, "demande à valider", "demandes à valider")}
        footer={<PiedDelai isAdmin={isAdmin} delai={delai} />}
      >
        <BigNumber
          value={formatNumberFr(pending)}
          label={noun(pending, "demande à valider", "demandes à valider")}
        />
        {old > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip
              icon="hourglass_empty"
              label={texteOld.long}
              visible={texteOld.court}
              className={SAND}
            />
          </div>
        )}
        {clarify > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip
              icon="help"
              label={plural(clarify, "clarification demandée", "clarifications demandées")}
              className={ROSE}
            />
          </div>
        )}
      </StatCard>

      <StatCard
        title="Actualités en attente"
        icon="edit_note"
        ariaLabel={plural(draftCount, "brouillon à finaliser", "brouillons à finaliser")}
        footer={<PiedActus actus={actus} />}
      >
        <BigNumber
          value={formatNumberFr(draftCount)}
          label={noun(draftCount, "brouillon à finaliser", "brouillons à finaliser")}
        />
        {isAdmin && draftsMine > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip icon="person" label={`dont ${draftsMine} à toi`} className={ROSE} />
          </div>
        )}
      </StatCard>

      <StatCard
        title="Alertes opérationnelles"
        icon="notification_important"
        ariaLabel={plural(alertTotal, "alerte", "alertes")}
        footer={
          <LienBasBloc href="#alertes" align="droite">
            {isAdmin ? "Gérer les alertes" : "Voir les alertes"}
          </LienBasBloc>
        }
      >
        <BigNumber
          value={formatNumberFr(alertTotal)}
          label={noun(alertTotal, "alerte", "alertes")}
        />
        {parts.length > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip icon="warning" label={parts.join(", ")} className={ROSE} />
          </div>
        )}
        {isAdmin && (alerts?.critical ?? 0) > 0 && (
          <p className="font-label-sm text-sm text-[#C2272D]">
            {`dont ${plural(alerts?.critical ?? 0, "critique", "critiques")}`}
          </p>
        )}
      </StatCard>
    </div>
  );
}

/** Ligne de 4 chips de la section « Mes demandes », toujours affichée, 0 compris. */
export function MyChips({ counts }: { counts: MyCounts | undefined }) {
  const c = counts ?? { toComplete: 0, pending: 0, validated: 0, refused: 0 };
  return (
    <div className="flex flex-wrap gap-xs">
      <Chip icon="help" label={`${formatNumberFr(c.toComplete)} à compléter`} className={ROSE} />
      <Chip
        icon="hourglass_empty"
        label={`${formatNumberFr(c.pending)} en attente`}
        className={SAND}
      />
      <Chip icon="check" label={plural(c.validated, "validée", "validées")} className={GREEN} />
      <Chip icon="close" label={plural(c.refused, "refusée", "refusées")} className={RED} />
    </div>
  );
}
