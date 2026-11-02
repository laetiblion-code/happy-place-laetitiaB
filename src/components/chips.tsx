import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";

/**
 * Composants visuels communs (chips, étiquettes, liens de bas de bloc). Un seul style partout :
 * aucun bloc ne recopie ces classes à la main. Une chip est un statut, jamais un bouton :
 * pas de bordure, pas d'ombre, pas de curseur main.
 */

/** Icône Material Symbols décorative : le texte à côté porte le sens. */
export function IconeMateriel({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Couleurs de statut (fonds clairs, textes à 4,5:1 minimum). Les classes sont passées par les appelants. */
export const COULEUR_STATUT = {
  sable: "bg-[#F0D0BC] text-[#28282D]",
  rose: "bg-[#F5D5D4] text-[#28282D]",
  vert: "bg-[#DDF2E3] text-[#1F6B38]",
  rouge: "bg-[#FFDAD6] text-[#A81E25]",
  gris: "bg-[#EDEBE6] text-[#28282D]",
} as const;

/**
 * Chip de statut : rectangle à coins de 4 px, 24 px de haut, icône de 16 px, texte de 13 px semi-gras.
 * `label` (optionnel) : texte complet pour les lecteurs d'écran, quand l'affichage est abrégé.
 */
export function ChipStatut({
  icon,
  label,
  couleur,
  children,
  className = "",
}: {
  icon?: string;
  /** Texte complet lu par les lecteurs d'écran (remplace le contenu visible). */
  label?: string;
  couleur: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      role={label ? "group" : undefined}
      aria-label={label}
      className={`inline-flex min-h-6 max-w-full items-center gap-xs rounded-[4px] px-[8px] py-[2px] text-[13px] font-semibold leading-snug cursor-default ${couleur} ${className}`}
    >
      {icon && <IconeMateriel name={icon} className="text-[16px]" />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** Pilule de visibilité (Privée, Mon équipe, Entreprise) : même hauteur que la chip de statut. */
export function PiluleVisibilite({
  icon: Icone,
  children,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-6 max-w-full items-center gap-xs rounded-full bg-[#EDEBE6] px-[8px] py-[2px] text-[13px] font-medium leading-snug text-[#28282D]">
      {Icone && <Icone aria-hidden={true} className="h-4 w-4 shrink-0" />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** Étiquette de type de demande : capitales, 22 px de haut, pastille anthracite de 16 px à icône blanche. */
export function EtiquetteType({
  icon: Icone,
  children,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-[22px] max-w-full items-center gap-xs rounded-[4px] bg-[#EDEBE6] py-[2px] pl-[3px] pr-[8px] text-[12px] font-bold uppercase leading-snug tracking-[0.06em] text-[#28282D]">
      {Icone && (
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#28282D] text-white"
        >
          <Icone aria-hidden={true} className="h-2.5 w-2.5" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** Classe commune des liens de bas de bloc : gras, sans soulignement, souligné au survol et au focus. */
const CLASSE_LIEN_BAS =
  "inline-flex min-h-11 items-center gap-xs text-sm font-bold text-primary no-underline hover:underline focus:outline-none focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Lien de bas de bloc : texte gras suivi d'une flèche (icône 18 px). `align` : « centre » pour les listes,
 * « droite » pour les cartes et les colonnes. `icone` (optionnel) précède le texte (ex. historique).
 * Avec `to`, c'est un lien ; sans `to`, un bouton (`onClick`).
 */
export function LienBasBloc({
  to,
  href,
  onClick,
  align = "centre",
  icone,
  ariaLabel,
  children,
}: {
  to?: string;
  /** Ancre de la page (ex. « #alertes »). */
  href?: string;
  onClick?: () => void;
  align?: "centre" | "droite";
  icone?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const contenu = (
    <>
      {icone && <IconeMateriel name={icone} className="text-[18px]" />}
      <span>{children}</span>
      <IconeMateriel name="arrow_forward" className="text-[18px]" />
    </>
  );
  const wrapper = align === "centre" ? "flex justify-center" : "flex justify-end";
  return (
    <div className={wrapper}>
      {to ? (
        <Link to={to} aria-label={ariaLabel} className={CLASSE_LIEN_BAS}>
          {contenu}
        </Link>
      ) : href ? (
        <a href={href} aria-label={ariaLabel} className={CLASSE_LIEN_BAS}>
          {contenu}
        </a>
      ) : (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={CLASSE_LIEN_BAS}>
          {contenu}
        </button>
      )}
    </div>
  );
}

/**
 * Boutons de carte : 36 px visibles, cible tactile de 44 px (la zone déborde de 4 px en haut et en bas).
 * À combiner avec buttonVariants (variante default, secondary ou destructive).
 */
export const CLASSE_BOUTON_CARTE =
  "relative h-9 min-h-9 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']";
// Usage : cn(buttonVariants({ variant: "secondary" }), CLASSE_BOUTON_CARTE) (cn fusionne min-h-11 avec min-h-9).
