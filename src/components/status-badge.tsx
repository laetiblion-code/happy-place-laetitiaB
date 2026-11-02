import { Linkify } from "@/components/linkify";
import { ChipStatut, COULEUR_STATUT } from "@/components/chips";

/** Une demande « à clarifier » est une demande refusée avec cette catégorie (pas de statut dédié). */
export const CLARIFY_CATEGORY = "à clarifier";

type StatusStyle = { label: string; icon: string; className: string };

const STATUS_STYLES: Record<"en attente" | "clarification" | "validée" | "refusée", StatusStyle> = {
  "en attente": {
    label: "En attente",
    icon: "hourglass_empty",
    className: COULEUR_STATUT.sable,
  },
  clarification: {
    label: "Clarification demandée",
    icon: "help",
    className: COULEUR_STATUT.rose,
  },
  validée: { label: "Validée", icon: "check", className: COULEUR_STATUT.vert },
  refusée: { label: "Refusée", icon: "close", className: COULEUR_STATUT.rouge },
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
    return <span className="font-label-sm text-sm text-on-surface-variant">{status}</span>;
  const style = STATUS_STYLES[key];
  return (
    <ChipStatut icon={style.icon} couleur={style.className}>
      {style.label}
    </ChipStatut>
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
              {" : "}
              <Linkify text={note} />
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
