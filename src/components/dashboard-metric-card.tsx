import { useEffect, useState } from "react";
import {
  evaluerTendance,
  formatDateCourte,
  formatMetricValue,
  formatObjectif,
  libelleTendance,
  progressionObjectif,
  type Metric,
  type Tendance,
} from "@/lib/dashboard";

/** Couleurs de tendance : contraste 4,5:1 sur fond blanc. Le sens est aussi porté par l'icône et le texte. */
const COULEUR_TENDANCE: Record<Tendance, string> = {
  favorable: "#1F6B38",
  defavorable: "#A81E25",
  stable: "#68686D",
};

const ICONE_TENDANCE: Record<Metric["trend"], string> = {
  hausse: "trending_up",
  baisse: "trending_down",
  stable: "trending_flat",
};

const MOT_TENDANCE: Record<Tendance, string> = {
  favorable: ", favorable",
  defavorable: ", défavorable",
  stable: "",
};

/** Remplissage en dégradé dans la charte, sans jaune. Le texte de pourcentage porte aussi l'information. */
const DEGRADE_EN_COURS = "linear-gradient(90deg, #F5D5D4, #C99695)";
const DEGRADE_ATTEINT = "linear-gradient(90deg, #B8DCC4, #1F6B38)";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/**
 * Barre de progression vers l'objectif : pilule de 10 px, piste bordée, pourcentage écrit à droite dessous.
 * Le remplissage glisse au chargement, sauf si la personne préfère moins de mouvement (motion-safe).
 */
function BarreObjectif({
  ratio,
  atteint,
  libelle,
  valeurTexte,
  objectif,
  plusBasEstMieux,
}: {
  ratio: number;
  atteint: boolean;
  libelle: string;
  valeurTexte: string;
  objectif: string;
  plusBasEstMieux: boolean;
}) {
  const pourcent = Math.round(ratio * 100);
  // Le remplissage part de 0 puis atteint sa valeur après le premier affichage (transition visible au chargement)
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLargeur(pourcent));
    return () => cancelAnimationFrame(id);
  }, [pourcent]);

  const valeurAccessible = plusBasEstMieux
    ? `${valeurTexte} pour un objectif de ${objectif}, plus bas est mieux`
    : `${valeurTexte} sur un objectif de ${objectif}`;

  return (
    <div className="flex flex-col gap-xs">
      <div
        role="meter"
        aria-label={`Avancement vers l'objectif, ${libelle}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcent}
        aria-valuetext={valeurAccessible}
        className="h-2.5 w-full overflow-hidden rounded-full border border-[#8A8A90] bg-[#EDEBE6]"
      >
        <div
          className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
          style={{
            width: `${largeur}%`,
            backgroundImage: atteint ? DEGRADE_ATTEINT : DEGRADE_EN_COURS,
          }}
        />
      </div>
      <p aria-hidden="true" className="self-end font-label-sm text-sm tabular-nums text-[#68686D]">
        {formatObjectif(pourcent, "%")}
      </p>
    </div>
  );
}

/**
 * Carte d'un indicateur de l'accueil, dans cet ordre : libellé, valeur, tendance, trait séparateur,
 * ligne d'objectif, barre de progression (si objectif), date de mise à jour.
 */
export function DashboardMetricCard({ metric: m }: { metric: Metric }) {
  const tendance = evaluerTendance(m);
  const progression = progressionObjectif(m);
  const objectif = m.target != null ? formatObjectif(m.target, m.unit) : null;
  const plusBasEstMieux = m.higher_is_better === false;
  const valeurTexte = formatMetricValue(m.value, m.unit);

  return (
    <article className="flex flex-col gap-xs rounded-md border border-outline-variant bg-card p-sm min-w-0">
      <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant wrap-anywhere">
        {m.label}
      </h3>
      <p className="flex flex-wrap items-baseline gap-x-xs text-primary">
        <span className="font-body-md text-[32px] font-semibold leading-tight tabular-nums">
          {valeurTexte}
        </span>
        {progression === null && (
          <span className="font-label-sm text-sm text-on-surface-variant">en cours</span>
        )}
      </p>

      <p
        className="flex items-start gap-xs font-label-sm text-sm font-semibold"
        style={{ color: COULEUR_TENDANCE[tendance] }}
      >
        <Icon name={ICONE_TENDANCE[m.trend]} className="text-base shrink-0" />
        <span>
          {libelleTendance(m)}
          <span className="sr-only">{MOT_TENDANCE[tendance]}</span>
        </span>
      </p>

      <hr className="border-t border-[#CDCDD1]" />

      {progression && objectif && (
        <>
          <p className="flex items-start gap-xs font-label-sm text-sm text-on-surface">
            <Icon name="flag" className="text-base shrink-0" />
            <span>{`Objectif ${objectif} en fin de semestre`}</span>
          </p>
          <BarreObjectif
            ratio={progression.ratio}
            atteint={progression.atteint}
            libelle={m.label}
            valeurTexte={valeurTexte}
            objectif={objectif}
            plusBasEstMieux={plusBasEstMieux}
          />
        </>
      )}

      {m.updated_at && (
        <p className="font-label-sm text-sm text-on-surface-variant">
          {`Mis à jour le ${formatDateCourte(m.updated_at)}`}
        </p>
      )}
    </article>
  );
}
