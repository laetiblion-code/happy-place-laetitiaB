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
 * Socle commun des chips et des pilules : 24 px de haut exactement, texte de 13 px, interligne de 16 px,
 * marge intérieure verticale de 2 px. Toute pastille de statut ou de visibilité part de cette classe.
 */
const SOCLE_PASTILLE =
  "inline-flex h-6 max-w-full items-center gap-xs px-[8px] py-[2px] text-[13px] leading-[16px] whitespace-nowrap";

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
      className={`${SOCLE_PASTILLE} rounded-[4px] font-semibold cursor-default ${couleur} ${className}`}
    >
      {icon && (
        <IconeMateriel
          name={icon}
          className="!flex !h-4 !w-4 shrink-0 items-center justify-center overflow-visible !text-[16px] !leading-none"
        />
      )}
      <span className="min-w-0 truncate">{children}</span>
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
    <span className={`${SOCLE_PASTILLE} rounded-full bg-[#EDEBE6] font-medium text-[#28282D]`}>
      {Icone && <Icone aria-hidden={true} className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/**
 * Étiquette de type de demande : capitales, 24 px de haut (même hauteur que les chips), pastille anthracite
 * de 20 px à icône blanche de 14 px centrée.
 */
export function EtiquetteType({
  icon: Icone,
  children,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex h-6 max-w-full whitespace-nowrap items-center gap-xs rounded-[4px] bg-[#EDEBE6] pl-[2px] pr-[8px] text-[12px] font-bold uppercase leading-none tracking-[0.06em] text-[#28282D]">
      {Icone && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#28282D] text-white"
        >
          <Icone aria-hidden={true} className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** Petite étiquette « Toi » (actualités) ou « Moi » (demandes) : après le nom de la personne connectée. */
export function EtiquetteSoi({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[4px] bg-[#F5D5D4] px-xs font-semibold leading-snug text-[12px] text-[#28282D]">
      {children}
    </span>
  );
}

/**
 * Soulignement des liens : porté par le texte seul (dans un span), jamais par l'icône qui l'accompagne.
 * Le lien ou le bouton parent porte la classe `group`.
 */
export const TEXTE_SOULIGNE = "group-hover:underline group-focus-visible:underline";

/** Lien d'action d'une ligne ou d'une carte : texte semi-gras souligné au survol et au focus, icône à côté. */
export const CLASSE_LIEN_ACTION =
  "group inline-flex min-h-11 items-center gap-xs text-sm font-semibold text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

/** Variante destructive (suppression) de CLASSE_LIEN_ACTION. */
export const CLASSE_LIEN_SUPPRIMER = CLASSE_LIEN_ACTION.replace("text-primary", "text-[#C2272D]");

/** Classe commune des liens de bas de bloc : gras, sans soulignement, souligné au survol et au focus. */
const CLASSE_LIEN_BAS =
  "group inline-flex min-h-11 items-center gap-xs text-sm font-bold text-primary no-underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Lien de bas de bloc : texte gras suivi d'une flèche (icône 18 px). `align` : « centre » pour les listes,
 * « droite » pour les cartes et les colonnes. `icone` (optionnel) précède le texte (ex. historique).
 * Avec `to`, c'est un lien ; sans `to`, un bouton (`onClick`).
 */
export function LienBasBloc({
  to,
  search,
  href,
  onClick,
  align = "centre",
  icone,
  ariaLabel,
  children,
}: {
  to?: string;
  /** Paramètres de recherche de l'adresse `to` (ex. `{ type: "idee" }`). */
  search?: Record<string, string>;
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
      <span className={TEXTE_SOULIGNE}>{children}</span>
      <IconeMateriel name="arrow_forward" className="text-[18px]" />
    </>
  );
  const wrapper = align === "centre" ? "flex justify-center" : "flex justify-end";
  return (
    <div className={wrapper}>
      {to ? (
        <Link to={to} search={search} aria-label={ariaLabel} className={CLASSE_LIEN_BAS}>
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
