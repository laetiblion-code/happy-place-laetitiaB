import { ChipStatut, COULEUR_STATUT } from "@/components/chips";
import { DureeCourte } from "@/components/duree-courte";
import { SEUIL_ATTENTE_MS } from "@/components/filtres-demandes";

/**
 * Chip « où et depuis quand » d'une demande en attente ou à clarifier : « En attente chez Kesha depuis 2 j ».
 * Au-delà de 3 jours depuis le dernier changement de statut : rouge, avec l'icône horloge.
 * Le délai part du dernier changement de statut (`depuis`).
 */
export function ChipAttente({
  libelle,
  depuis,
  clarification = false,
  maintenant = Date.now(),
}: {
  libelle: string;
  /** Date ISO du dernier changement de statut (ou de la création, à défaut). */
  depuis: string;
  clarification?: boolean;
  maintenant?: number;
}) {
  const longue = maintenant - new Date(depuis).getTime() > SEUIL_ATTENTE_MS;
  const couleur = longue
    ? COULEUR_STATUT.rouge
    : clarification
      ? COULEUR_STATUT.rose
      : COULEUR_STATUT.sable;
  const icone = longue ? "schedule" : clarification ? "help" : "hourglass_empty";
  return (
    <ChipStatut icon={icone} couleur={couleur}>
      {libelle}
      {" depuis "}
      <DureeCourte iso={depuis} />
    </ChipStatut>
  );
}
