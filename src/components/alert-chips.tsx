import { ALERT_STATES, SEVERITY_STYLES, isAlertStatus } from "@/lib/alert-states";
import { ChipStatut, COULEUR_STATUT } from "@/components/chips";

/** État d'une alerte : icône et texte, comme sur l'accueil. */
export function AlertStateChip({ status }: { status: string }) {
  if (!isAlertStatus(status)) {
    return <ChipStatut couleur={COULEUR_STATUT.gris}>{status}</ChipStatut>;
  }
  const s = ALERT_STATES[status];
  return (
    <ChipStatut icon={s.icon} couleur={s.className}>
      {s.label}
    </ChipStatut>
  );
}

/** Sévérité d'une alerte : Critique, Avertissement ou Information, avec icône. */
export function SeverityChip({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? {
    label: severity,
    icon: "info",
    className: COULEUR_STATUT.gris,
  };
  return (
    <ChipStatut icon={s.icon} couleur={s.className}>
      {s.label}
    </ChipStatut>
  );
}
