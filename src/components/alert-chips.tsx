import { ALERT_STATES, SEVERITY_STYLES, isAlertStatus } from "@/lib/alert-states";

const CHIP =
  "inline-flex items-center gap-xs rounded-full px-sm py-[2px] font-label-sm text-label-sm font-semibold";

function Icon({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="material-symbols-outlined text-base">
      {name}
    </span>
  );
}

/** État d'une alerte : icône et texte, comme sur l'accueil. */
export function AlertStateChip({ status }: { status: string }) {
  if (!isAlertStatus(status)) {
    return <span className={`${CHIP} bg-surface-container-highest text-on-surface`}>{status}</span>;
  }
  const s = ALERT_STATES[status];
  return (
    <span className={`${CHIP} ${s.className}`}>
      <Icon name={s.icon} />
      {s.label}
    </span>
  );
}

/** Sévérité d'une alerte : Critique, Avertissement ou Information, avec icône. */
export function SeverityChip({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? {
    label: severity,
    icon: "info",
    className: "bg-surface-container-highest text-on-surface",
  };
  return (
    <span className={`${CHIP} ${s.className}`}>
      <Icon name={s.icon} />
      {s.label}
    </span>
  );
}
