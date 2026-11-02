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

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/**
 * Carte d'un indicateur de l'accueil : libellé, valeur, tendance, barre vers l'objectif (si objectif),
 * ligne d'objectif, date de mise à jour. Les informations tiennent en texte : la barre n'est pas indispensable.
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

      {progression && objectif && (
        <div
          role="meter"
          aria-label={`Avancement vers l'objectif, ${m.label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progression.ratio * 100)}
          aria-valuetext={
            plusBasEstMieux
              ? `${valeurTexte} pour un objectif de ${objectif}, plus bas est mieux`
              : `${valeurTexte} sur un objectif de ${objectif}`
          }
          className="h-1.5 w-full overflow-hidden rounded-full border border-[#8A8A90] bg-[#EDEBE6]"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(progression.ratio * 100)}%`,
              backgroundColor: progression.atteint ? "#1F6B38" : "#28282D",
            }}
          />
        </div>
      )}

      <hr className="border-t border-[#CDCDD1]" />

      {objectif && (
        <p className="flex items-start gap-xs font-label-sm text-sm text-on-surface">
          <Icon name="flag" className="text-base shrink-0" />
          <span>{`Objectif ${objectif} en fin de semestre`}</span>
        </p>
      )}
      {m.updated_at && (
        <p className="font-label-sm text-sm text-on-surface-variant">
          {`Mis à jour le ${formatDateCourte(m.updated_at)}`}
        </p>
      )}
    </article>
  );
}
