import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import sharkLogo from "@/assets/bigger-boat-shark.png";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * En-tête commun. Happy Place est au centre, en plus grand que Bigger Boat (à gauche, masqué sous 1024 px).
 * Le bloc utilisateur (`account`) est à droite ; sans lui (personne connecté), l'en-tête reste centré.
 * Sous 1024 px, l'en-tête tient sur deux lignes : Happy Place, puis le compte. Pas de défilement horizontal.
 */
export function BrandHeader({ account }: { account?: ReactNode }) {
  const grille = account
    ? "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
    : "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]";

  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest">
      <div
        className={`mx-auto grid w-full max-w-interface grid-cols-1 items-center justify-items-center gap-sm px-sm py-sm md:px-md ${grille}`}
      >
        <Link
          to="/"
          aria-label="Bigger Boat, accueil"
          className={`hidden min-w-0 items-center gap-sm justify-self-start lg:flex ${FOCUS}`}
        >
          <img
            src={sharkLogo}
            alt=""
            width={1024}
            height={1024}
            className="h-11 w-14 shrink-0 object-contain"
          />
          <span className="flex min-w-0 flex-col">
            <span className="font-label-sm text-xs uppercase tracking-widest text-on-surface-variant">
              Cabinet de recrutement
            </span>
            <span className="font-label-md text-lg font-bold uppercase leading-tight text-primary">
              Bigger Boat
            </span>
          </span>
        </Link>

        <Link
          to="/"
          aria-label="Happy Place, accueil"
          className={`flex min-w-0 flex-col items-center rounded-sm text-center ${FOCUS}`}
        >
          <span className="font-headline-lg text-[2.25rem] leading-none text-primary md:text-[2.75rem]">
            Happy Place
          </span>
          <span className="mt-xs font-label-sm text-xs uppercase tracking-[0.2em] text-on-surface-variant">
            Espace collaboratif talents
          </span>
        </Link>

        {account && <div className="min-w-0 justify-self-end">{account}</div>}
      </div>
    </header>
  );
}
