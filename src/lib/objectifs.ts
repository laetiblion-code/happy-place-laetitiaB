/**
 * Objectifs fixes du trimestre, affichés sous les compteurs de l'accueil.
 * Source : maquettes Stitch et document « 00. Contexte Happy Place ».
 * Constante côté client : aucun changement de base de données.
 */
export const OBJECTIFS_TRIMESTRE = { delaiValidationJours: 2, tauxPublicationActus: 70 } as const;

export type EtatObjectif = "atteint" | "presque" | "non";

/** Écart à partir duquel un objectif est « presque atteint » : 10 % de l'objectif. */
const SEUIL_PRESQUE = 0.1;

/**
 * État d'un objectif. « plusBas » : atteint sous l'objectif (délai). « plusHaut » : atteint à partir de l'objectif (taux).
 * Presque atteint si l'écart est de 10 % ou moins de l'objectif. La valeur est comparée arrondie à une décimale,
 * comme elle est affichée.
 */
export function etatObjectif(
  valeur: number,
  objectif: number,
  sens: "plusBas" | "plusHaut",
): EtatObjectif {
  const v = Math.round(valeur * 10) / 10;
  if (sens === "plusBas") {
    if (v < objectif) return "atteint";
    return (v - objectif) / objectif <= SEUIL_PRESQUE ? "presque" : "non";
  }
  if (v >= objectif) return "atteint";
  return (objectif - v) / objectif <= SEUIL_PRESQUE ? "presque" : "non";
}
