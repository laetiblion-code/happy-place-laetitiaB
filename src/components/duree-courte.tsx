import { decomposerDuree } from "@/lib/dashboard";

/**
 * Unité abrégée : « 5 j », « 18 h ». L'abréviation est masquée des lecteurs d'écran, qui lisent le mot entier.
 * `valeur` est déjà formatée (virgule décimale) ; `pluriel` choisit « jour » ou « jours » pour la lecture.
 */
export function Unite({
  valeur,
  unite,
  pluriel,
}: {
  valeur: string;
  unite: "j" | "h";
  pluriel: boolean;
}) {
  const mot = unite === "j" ? (pluriel ? "jours" : "jour") : pluriel ? "heures" : "heure";
  return (
    <>
      {valeur}
      {"\u00a0"}
      <span aria-hidden="true">{unite}</span>
      <span className="sr-only"> {mot}</span>
    </>
  );
}

/** Délai depuis une date, en version courte pour les libellés : « 5 j », « 18 h », « 42 minutes ». */
export function DureeCourte({ iso }: { iso: string }) {
  const d = decomposerDuree(iso);
  if (d.unite === "instant") return <>moins d'une minute</>;
  if (d.unite === "minute") return <>{`${d.n} minute${d.n > 1 ? "s" : ""}`}</>;
  if (d.unite === "heure") return <Unite valeur={String(d.n)} unite="h" pluriel={d.n > 1} />;
  return <Unite valeur={String(d.n)} unite="j" pluriel={d.n > 1} />;
}
