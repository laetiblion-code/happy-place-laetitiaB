import { Linkify } from "@/components/linkify";

/** Une demande « à clarifier » est une demande refusée avec cette catégorie (pas de statut dédié). */
export const CLARIFY_CATEGORY = "à clarifier";

type StatusStyle = { label: string; icon: string; className: string };

const STATUS_STYLES: Record<"en attente" | "clarification" | "validée" | "refusée", StatusStyle> = {
  "en attente": {
    label: "En attente",
    icon: "hourglass_empty",
    className: "bg-[#F0D0BC] text-[#28282D]",
  },
  clarification: {
    label: "Clarification demandée",
    icon: "help",
    className: "bg-[#F5D5D4] text-[#28282D]",
  },
  validée: { label: "Validée", icon: "check", className: "bg-[#DDF2E3] text-[#298646]" },
  refusée: { label: "Refusée", icon: "close", className: "bg-[#FFDAD6] text-[#C2272D]" },
};

/**
 * Statut d'une demande en rectangle : icône et texte, jamais la couleur seule.
 * Une demande refusée « à clarifier » s'affiche « Clarification demandée ».
 */
export function StatusBadge({
  status,
  rejectionCategory,
}: {
  status: string;
  rejectionCategory?: string | null;
}) {
  const key =
    status === "refusée" && rejectionCategory === CLARIFY_CATEGORY
      ? "clarification"
      : status in STATUS_STYLES
        ? (status as keyof typeof STATUS_STYLES)
        : null;
  if (!key)
    return <span className="font-label-sm text-label-sm text-on-surface-variant">{status}</span>;
  const style = STATUS_STYLES[key];
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-md px-xs py-[2px] font-label-sm text-label-sm font-semibold ${style.className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-sm">
        {style.icon}
      </span>
      {style.label}
    </span>
  );
}

/** Encadré blanc bordé : motif du refus, ou question de clarification. */
export function RejectionNote({
  category,
  note,
}: {
  category?: string | null;
  note?: string | null;
}) {
  if (!category) return null;
  const clarify = category === CLARIFY_CATEGORY;
  return (
    <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
      {clarify ? (
        <p className="whitespace-pre-line">
          <strong>Clarification demandée :</strong> <Linkify text={note ?? ""} />
        </p>
      ) : (
        <p className="whitespace-pre-line">
          <strong>Motif du refus :</strong> {category}
          {note ? (
            <>
              {" — "}
              <Linkify text={note} />
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
