import type { ReactNode } from "react";
import { formatDateCourte, formatNumberFr } from "@/lib/dashboard";
import { Unite } from "@/components/duree-courte";
import { ChipStatut, LienBasBloc, COULEUR_STATUT } from "@/components/chips";
import {
  noun,
  plural,
  type AlertCounts,
  type DelaiValidation,
  type DraftCounts,
  type MesActus,
  type MyCounts,
  type PublicationActus,
  type ReviewCounts,
} from "@/lib/home-counts";
import {
  CIBLE_ACTUS,
  CIBLE_DELAI,
  detailAlertes,
  incitationPublication,
  libelleAttente,
  libelleBrouillons,
  libelleLienBrouillons,
  suiteObjectif,
  phraseRetard,
} from "@/lib/compteurs-accueil";
import { etatObjectif, OBJECTIFS_TRIMESTRE, type EtatObjectif } from "@/lib/objectifs";
import { AideCompteur } from "@/components/aide-compteur";

/** Textes des info-bulles « Comment est calculé ce chiffre ? » (décision du 2026-11-03 sur le délai). */
const INFO_DELAI_CABINET =
  "Calcul effectué sur le délai de traitement des demandes en attente du cabinet sur les 30 derniers jours. Une demande de clarification et un refus sont considérés comme un traitement.";
const INFO_DELAI_MANAGER =
  "Calcul effectué sur le délai de traitement des demandes en attente chez toi sur les 30 derniers jours. Une demande de clarification et un refus sont considérés comme un traitement.";
const INFO_ACTUS_CABINET =
  "Nombre d'actualités publiées par rapport au nombre d'actualités commencées sur les 30 derniers jours.";
const INFO_ACTUS_MANAGER =
  "Nombre d'actualités que tu as publiées par rapport au nombre d'actualités que tu as commencées sur les 30 derniers jours.";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Chip de statut (ligne « Mes demandes »). `label` : texte complet (lecteurs d'écran) ; `visible` : version affichée. */
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

/**
 * Fait défiler jusqu'au bloc dont le titre a l'identifiant donné, puis place le focus sur ce titre.
 * Défilement instantané si la personne demande moins de mouvement.
 */
function allerAuBloc(idTitre: string) {
  const titre = document.getElementById(idTitre);
  if (!titre) return;
  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  (titre.closest("section") ?? titre).scrollIntoView({
    behavior: reduit ? "auto" : "smooth",
    block: "start",
  });
  titre.focus({ preventScroll: true });
}

/**
 * Carte de compteur. Quatre lignes alignées entre cartes du même rang (sous-grille en bureau) :
 * titre, texte du chiffre, pied (délai ou objectif), lien d'action en bas à droite.
 */
function StatCard({
  title,
  ariaLabel,
  children,
  pied,
  action,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
  pied?: ReactNode;
  action: ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="grid grid-rows-[auto_1fr_auto_auto] gap-y-0 rounded-lg border border-[#CDCDD1] bg-white px-[22px] pt-[22px] pb-[6px] md:row-span-4 md:grid-rows-subgrid"
    >
      <h2 className="mb-[14px] font-['Bodoni_Moda',Georgia,serif] text-[clamp(20px,1.2vw+12px,24px)] font-medium leading-snug text-primary">
        {title}
      </h2>
      <div className="flex flex-col gap-xs">{children}</div>
      <div className="mt-[18px]">{pied}</div>
      {/* Lien de bas de carte : trait fin, zone de 48 px, aligné à droite, même hauteur dans les 3 cartes */}
      <div className="mt-[14px] flex min-h-[48px] items-center justify-end border-t border-[#EDEBE6]">
        {action}
      </div>
    </section>
  );
}

/** Chiffre (56 px semi-gras) et libellé (22 px) sur une ligne ; le détail suit, aligné à gauche. */
function Gros({
  nombre,
  libelle,
  details,
}: {
  nombre?: string;
  libelle: string;
  details?: ReactNode[];
}) {
  return (
    <div className="flex flex-col">
      <p className="flex items-baseline gap-[12px] text-on-surface">
        {nombre !== undefined && (
          <span className="text-[56px] font-semibold leading-none tabular-nums">{nombre}</span>
        )}
        <span className="text-[22px] leading-snug">{libelle}</span>
      </p>
      {details && details.length > 0 && (
        <p className="mt-[14px] text-[16px] leading-6 text-[#68686D]">
          {details.map((d, i) => (
            <span key={i} className="block">
              {d}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Mise en valeur d'un détail (« 8 jours », « 5 à toi ») : fond rose, semi-gras, coins de 3 px. */
function Surligne({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-[3px] bg-[#F5D5D4] px-[5px] font-semibold text-[#28282D] ${className}`}
    >
      {children}
    </span>
  );
}

/** Ligne d'objectif : icône, puis « Objectif X : suite ». X est lu en toutes lettres par les lecteurs d'écran. */
const ETAT_STYLE: Record<EtatObjectif, { icon: string; classe: string }> = {
  atteint: { icon: "check_circle", classe: "text-[#1F6B38]" },
  presque: { icon: "track_changes", classe: "text-[#3F3F44]" },
  // Sable foncé, contraste AA (environ 7,8:1 sur blanc)
  non: { icon: "flag", classe: "text-[#7A4E16]" },
};

function LigneEtat({
  etat,
  cible,
  admin,
}: {
  etat: EtatObjectif;
  cible: { court: string; long: string };
  admin: boolean;
}) {
  const style = ETAT_STYLE[etat];
  return (
    <p className={`flex items-start gap-xs text-[16px] font-semibold ${style.classe}`}>
      <Icon name={style.icon} className="text-base shrink-0" />
      <span>
        Objectif{" "}
        {cible.court === cible.long ? (
          cible.court
        ) : (
          <>
            <span aria-hidden="true">{cible.court}</span>
            <span className="sr-only">{cible.long}</span>
          </>
        )}{" "}
        : {suiteObjectif(etat, admin)}
      </span>
    </p>
  );
}

/** Pied de carte : trait fin au-dessus, texte gris (valeur) et ligne d'objectif. */
function PiedObjectif({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-xs border-t border-[#CDCDD1] pt-[16px]">{children}</div>;
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
        <p className="text-[16px] text-on-surface-variant">
          Pas encore de demande traitée sur 30 jours
        </p>
      </PiedObjectif>
    );
  }
  const { delaiValidationJours } = OBJECTIFS_TRIMESTRE;
  const jours = formatNumberFr(delai.jours, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const etat = etatObjectif(delai.jours, delaiValidationJours, "plusBas");
  const libelle = isAdmin ? "Délai de validation : " : "Ton délai de validation : ";
  return (
    <PiedObjectif>
      <p className="flex flex-wrap items-center gap-xs text-[16px] text-[#68686D]">
        <span>{libelle}</span>
        <span className="inline-block rounded-[4px] bg-[#EDEBE6] px-2 font-semibold text-[#28282D]">
          <Unite valeur={jours} unite="j" pluriel={delai.jours >= 2} />
        </span>
        <AideCompteur texte={isAdmin ? INFO_DELAI_CABINET : INFO_DELAI_MANAGER} />
      </p>
      <LigneEtat etat={etat} cible={CIBLE_DELAI} admin={isAdmin} />
    </PiedObjectif>
  );
}

/**
 * Taux de publication des actualités créées dans les 30 derniers jours : tout le cabinet pour l'admin,
 * ses propres actualités pour le manager.
 */
function PiedActus({ actus, isAdmin }: { actus: PublicationActus | undefined; isAdmin: boolean }) {
  // Aucune actualité commencée sur 30 jours : pas de pied (pas de « 0 / 0 »)
  if (!actus || actus.commencees === 0) return null;
  const pourcentage = (100 * actus.publiees) / actus.commencees;
  const etat = etatObjectif(pourcentage, OBJECTIFS_TRIMESTRE.tauxPublicationActus, "plusHaut");
  const pourcentageAffiche = `${formatNumberFr(pourcentage, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}\u00a0%`;
  return (
    <PiedObjectif>
      <p className="flex flex-wrap items-center gap-xs text-[16px] text-[#68686D]">
        <span>{`${formatNumberFr(actus.publiees)} publiées / ${formatNumberFr(actus.commencees)} ·`}</span>
        <span className="inline-block rounded-[4px] bg-[#EDEBE6] px-2 font-semibold text-[#28282D]">
          {pourcentageAffiche}
        </span>
        <AideCompteur texte={isAdmin ? INFO_ACTUS_CABINET : INFO_ACTUS_MANAGER} />
      </p>
      <LigneEtat etat={etat} cible={CIBLE_ACTUS} admin={isAdmin} />
    </PiedObjectif>
  );
}

/** Demande en attente depuis le plus longtemps (périmètre du compteur), avec son nom court et ses jours. */
export type PlusAncienne = { nom: string; jours: number };

/** Trois cartes du haut de page pour le manager et l'admin. */
export function ManagerCards({
  isAdmin,
  review,
  plusAncienne,
  drafts,
  alerts,
  delai,
  actus,
  mesActus,
  onRediger,
}: {
  isAdmin: boolean;
  review: ReviewCounts | undefined;
  /** Demande en attente depuis plus de 3 jours la plus ancienne, sinon null. */
  plusAncienne: PlusAncienne | null;
  drafts: DraftCounts | undefined;
  alerts: AlertCounts | undefined;
  delai: DelaiValidation | null | undefined;
  actus: PublicationActus | undefined;
  /** Historique de la personne connectée, pour les incitations à publier. */
  mesActus: MesActus | undefined;
  /** Ouvre la fenêtre « Nouvelle actualité ». */
  onRediger: () => void;
}) {
  const pending = review?.pending ?? 0;
  const draftCount = drafts?.drafts ?? 0;
  const draftsMine = drafts?.draftsMine ?? 0;
  const alertTotal = alerts?.open ?? 0;
  // Rien à finaliser : on invite à publier, sauf si l'historique n'est pas encore chargé
  const rienAFinaliser = draftCount === 0 && mesActus !== undefined;
  const premiere = rienAFinaliser && mesActus.total === 0;
  const relance =
    rienAFinaliser &&
    mesActus.total > 0 &&
    mesActus.recentes === 0 &&
    mesActus.dernierePubliee !== null;
  const attente = libelleAttente(pending);
  // La phrase de retard n'a de sens que s'il reste une demande en attente
  const retard =
    plusAncienne && pending > 0 ? phraseRetard(plusAncienne.nom, plusAncienne.jours) : null;
  const incitation =
    actus && !premiere && !relance
      ? incitationPublication({
          publiees: actus.publiees,
          commencees: actus.commencees,
          brouillons: draftCount,
          objectifPourcent: OBJECTIFS_TRIMESTRE.tauxPublicationActus,
          admin: isAdmin,
        })
      : null;
  const alertesDetail = detailAlertes({
    ouverte: alerts?.ouverte ?? 0,
    enCours: alerts?.enCours ?? 0,
    surveillance: alerts?.surveillance ?? 0,
  });
  const critiques = alerts?.critical ?? 0;

  return (
    <div className="grid grid-cols-1 gap-sm md:grid-cols-3 md:grid-rows-[auto_1fr_auto_auto]">
      <StatCard
        title="Demandes en attente"
        ariaLabel={plural(pending, "demande à valider", "demandes à valider")}
        pied={<PiedDelai isAdmin={isAdmin} delai={delai} />}
        action={
          <LienBasBloc align="droite" onClick={() => allerAuBloc("titre-a-traiter")}>
            Je m'en occupe
          </LienBasBloc>
        }
      >
        <Gros
          nombre={attente.chiffre ? formatNumberFr(pending) : undefined}
          libelle={attente.texte}
          details={
            retard
              ? [
                  <>
                    {retard.debut}
                    <Surligne>{retard.jours}</Surligne>
                  </>,
                ]
              : undefined
          }
        />
      </StatCard>

      <StatCard
        title="Actualités en attente"
        ariaLabel={plural(draftCount, "brouillon à finaliser", "brouillons à finaliser")}
        pied={premiere || relance ? null : <PiedActus actus={actus} isAdmin={isAdmin} />}
        action={
          premiere ? (
            <LienBasBloc align="droite" onClick={onRediger}>
              Rédiger ma première actu
            </LienBasBloc>
          ) : relance || draftCount === 0 ? (
            <LienBasBloc align="droite" onClick={onRediger}>
              Rédiger une actu
            </LienBasBloc>
          ) : (
            <LienBasBloc align="droite" onClick={() => allerAuBloc("titre-actus")}>
              {libelleLienBrouillons(incitation?.nombre ?? draftCount, isAdmin)}
            </LienBasBloc>
          )
        }
      >
        <Gros
          nombre={formatNumberFr(draftCount)}
          libelle={libelleBrouillons(draftCount)}
          details={[
            isAdmin && draftsMine > 0 ? (
              <>
                dont <Surligne>{`${draftsMine} à toi`}</Surligne>
              </>
            ) : null,
            incitation?.phrase ?? null,
            premiere ? "Partage ta première actualité avec le cabinet." : null,
            relance && mesActus.dernierePubliee
              ? `Ta dernière actualité date du ${formatDateCourte(mesActus.dernierePubliee)}. Une nouvelle à partager ?`
              : null,
          ].filter((d) => d !== null)}
        />
      </StatCard>

      <StatCard
        title="Alertes opérationnelles"
        ariaLabel={plural(alertTotal, "alerte", "alertes")}
        pied={null}
        action={
          <LienBasBloc align="droite" onClick={() => allerAuBloc("titre-alertes")}>
            {isAdmin ? "Je gère les alertes" : "Je vais voir les alertes"}
          </LienBasBloc>
        }
      >
        {alertTotal === 0 ? (
          <Gros libelle="Aucune alerte en cours" />
        ) : (
          <Gros
            nombre={formatNumberFr(alertTotal)}
            libelle={noun(alertTotal, "alerte", "alertes")}
            details={
              isAdmin
                ? [
                    <>
                      {alertesDetail.join(", ")}
                      {critiques > 0 && (
                        <>
                          {", "}
                          <span className="font-semibold text-[#A81E25]">
                            {`dont ${plural(critiques, "critique", "critiques")}`}
                          </span>
                        </>
                      )}
                    </>,
                  ]
                : ["Rester informé des risques et points bloquants identifiés."]
            }
          />
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
