import { delaiTexte } from "@/lib/dashboard";
import { formatExactDate } from "@/components/expandable-card";

/**
 * Délai depuis le dernier changement de statut (et non depuis la création).
 * La date exacte est donnée au survol (title) et au focus clavier (élément focusable).
 */
export function DelaiStatut({ status, depuis }: { status: string; depuis: string }) {
  const delai = delaiTexte(depuis);
  const libelle =
    status === "en attente"
      ? `En attente depuis ${delai}`
      : status === "clarification"
        ? `En clarification depuis ${delai}`
        : status === "validée"
          ? `Validée il y a ${delai}`
          : status === "refusée"
            ? `Refusée il y a ${delai}`
            : `Mise à jour il y a ${delai}`;
  return (
    <span
      tabIndex={0}
      title={formatExactDate(depuis)}
      className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <time dateTime={depuis}>{libelle}</time>
    </span>
  );
}
