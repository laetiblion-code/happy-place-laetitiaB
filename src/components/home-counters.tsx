import type { ReactNode } from "react";
import {
  noun,
  plural,
  type AlertCounts,
  type DraftCounts,
  type MyCounts,
  type ReviewCounts,
} from "@/lib/home-counts";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Pilule d'information : icône et texte, jamais la couleur seule. */
function Chip({ icon, label, className }: { icon: string; label: string; className: string }) {
  return (
    <span
      role="group"
      aria-label={label}
      className={`inline-flex items-center gap-xs rounded-full px-sm py-[2px] font-label-sm text-label-sm ${className}`}
    >
      <Icon name={icon} className="text-base" />
      {label}
    </span>
  );
}

const SAND = "bg-[#F0D0BC] text-[#28282D]";
const ROSE = "bg-[#F5D5D4] text-[#28282D]";
const GREEN = "bg-[#DDF2E3] text-[#298646]";
const RED = "bg-[#FFDAD6] text-[#C2272D]";

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
        <h2 className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
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

/** Trois cartes du haut de page pour le manager et l'admin. */
export function ManagerCards({
  isAdmin,
  review,
  drafts,
  alerts,
}: {
  isAdmin: boolean;
  review: ReviewCounts | undefined;
  drafts: DraftCounts | undefined;
  alerts: AlertCounts | undefined;
}) {
  const pending = review?.pending ?? 0;
  const old = review?.pendingOverThreeDays ?? 0;
  const clarify = review?.toClarify ?? 0;
  const draftCount = drafts?.drafts ?? 0;
  const draftsMine = drafts?.draftsMine ?? 0;
  const alertTotal = alerts?.open ?? 0;
  const parts = [
    alerts?.ouverte ? plural(alerts.ouverte, "ouverte", "ouvertes") : null,
    alerts?.enCours ? `${alerts.enCours} en cours` : null,
    alerts?.surveillance ? `${alerts.surveillance} en surveillance` : null,
  ].filter((p): p is string => p !== null);

  return (
    <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
      <StatCard
        title="Demandes en attente"
        icon="pending_actions"
        ariaLabel={plural(pending, "demande à valider", "demandes à valider")}
      >
        <BigNumber
          value={String(pending)}
          label={noun(pending, "demande à valider", "demandes à valider")}
        />
        {old > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip
              icon="hourglass_empty"
              label={`${old} en attente depuis plus de 3 jours`}
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
      >
        <BigNumber
          value={String(draftCount)}
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
          <a
            href="#alertes"
            className="font-label-sm text-label-sm text-primary underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isAdmin ? "Gérer les alertes" : "Voir les alertes"}
          </a>
        }
      >
        <BigNumber value={String(alertTotal)} label={noun(alertTotal, "alerte", "alertes")} />
        {parts.length > 0 && (
          <div className="flex flex-wrap gap-xs">
            <Chip icon="warning" label={parts.join(", ")} className={ROSE} />
          </div>
        )}
        {isAdmin && (alerts?.critical ?? 0) > 0 && (
          <p className="font-label-sm text-label-sm text-[#C2272D]">
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
      <Chip icon="help" label={`${c.toComplete} à compléter`} className={ROSE} />
      <Chip icon="hourglass_empty" label={`${c.pending} en attente`} className={SAND} />
      <Chip icon="check" label={plural(c.validated, "validée", "validées")} className={GREEN} />
      <Chip icon="close" label={plural(c.refused, "refusée", "refusées")} className={RED} />
    </div>
  );
}
