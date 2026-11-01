/**
 * États des alertes opérationnelles : valeurs stockées en base, libellés, icônes et couleurs.
 * Constante partagée par l'accueil et la gestion. Les valeurs ne changent pas (elles sont en base).
 */
export const ALERT_STATES = {
  OUVERT: { label: "Ouverte", icon: "error_outline", className: "bg-[#FFDAD6] text-[#C2272D]" },
  "EN COURS": { label: "En cours", icon: "autorenew", className: "bg-[#F0D0BC] text-[#28282D]" },
  SURVEILLANCE: {
    label: "Sous surveillance",
    icon: "visibility",
    className: "bg-[#F5D5D4] text-[#28282D]",
  },
  RÉSOLU: { label: "Résolue", icon: "check_circle", className: "bg-[#DDF2E3] text-[#298646]" },
} as const;

export type AlertStatus = keyof typeof ALERT_STATES;

/**
 * Passages autorisés depuis chaque état (décision du 2026-10-31).
 * Le menu d'état ne propose que l'état actuel et ces passages.
 */
export const ALERT_TRANSITIONS: Record<AlertStatus, readonly AlertStatus[]> = {
  OUVERT: ["EN COURS", "SURVEILLANCE"],
  "EN COURS": ["SURVEILLANCE", "RÉSOLU"],
  SURVEILLANCE: ["RÉSOLU"],
  RÉSOLU: ["OUVERT", "SURVEILLANCE"],
};

/** États proposés à la création d'une alerte (une alerte nouvelle n'est pas résolue). */
export const NEW_ALERT_STATUSES: readonly AlertStatus[] = ["OUVERT", "EN COURS", "SURVEILLANCE"];

export function isAlertStatus(value: string): value is AlertStatus {
  return value in ALERT_STATES;
}

/** Options du menu : l'état actuel, puis les passages autorisés. */
export function alertStatusOptions(current: string): AlertStatus[] {
  if (!isAlertStatus(current)) return [];
  return [current, ...ALERT_TRANSITIONS[current]];
}

export const SEVERITY_STYLES: Record<string, { label: string; icon: string; className: string }> = {
  critical: {
    label: "Critique",
    icon: "error",
    className: "bg-error-container text-on-error-container",
  },
  warning: { label: "Avertissement", icon: "warning", className: "bg-[#F0D0BC] text-[#28282D]" },
  info: { label: "Information", icon: "info", className: "bg-[#EDEBE6] text-[#28282D]" },
};
