import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/** Onglets de la navigation admin. « Accueil » est le seul à correspondre exactement à sa page. */
const ONGLETS = [
  { to: "/", label: "Accueil", exact: true },
  { to: "/manage/submissions", label: "Demandes", exact: false },
  { to: "/manage/news", label: "Actualités", exact: false },
  { to: "/manage/blockers", label: "Alertes opérationnelles", exact: false },
  { to: "/manage/metrics", label: "Indicateurs", exact: false },
  { to: "/manage/users", label: "Utilisateurs et équipes", exact: false },
] as const;

/**
 * Barre d'onglets pleine largeur, sous l'en-tête (admin seulement).
 * Sur petit écran, elle défile à l'intérieur du nav (jamais la page) et l'onglet actif reste visible.
 */
export function MainNav() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const defile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conteneur = defile.current;
    const actif = conteneur?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!conteneur || !actif) return;
    const centre = actif.offsetLeft + actif.offsetWidth / 2;
    conteneur.scrollLeft = Math.max(0, centre - conteneur.clientWidth / 2);
  }, [chemin]);

  return (
    <nav
      aria-label="Navigation principale"
      className="border-b border-outline-variant bg-surface-container-lowest"
    >
      <div
        ref={defile}
        className="mx-auto flex w-full max-w-interface overflow-x-auto px-sm md:px-md"
      >
        {ONGLETS.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            activeOptions={{ exact: o.exact }}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-sm font-label-md text-sm text-on-surface-variant hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            activeProps={{
              className:
                "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 border-[#28282D] px-sm font-label-md text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
            }}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
