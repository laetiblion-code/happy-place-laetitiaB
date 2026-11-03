import { useId, useState } from "react";

/**
 * Petit bouton « ? » qui explique comment un chiffre est calculé. L'info-bulle s'affiche au survol, au focus
 * clavier et au toucher (un appui ouvre, le fait de quitter le bouton ferme) ; Échap la ferme. Le texte est
 * relié au bouton par `aria-describedby` tant qu'elle est ouverte. Texte blanc sur fond anthracite (contraste AA).
 */
export function AideCompteur({ texte }: { texte: string }) {
  const [ouvert, setOuvert] = useState(false);
  const idBulle = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Comment est calculé ce chiffre ?"
        aria-describedby={ouvert ? idBulle : undefined}
        onClick={() => setOuvert(true)}
        onMouseEnter={() => setOuvert(true)}
        onMouseLeave={() => setOuvert(false)}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && ouvert) {
            e.stopPropagation();
            setOuvert(false);
          }
        }}
        className="inline-flex size-6 items-center justify-center rounded-full border border-[#68686D] bg-white text-[#28282D] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] leading-none">
          help
        </span>
      </button>
      {ouvert && (
        <span
          role="tooltip"
          id={idBulle}
          className="absolute bottom-full left-1/2 z-20 mb-xs w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-[#28282D] px-sm py-xs text-left font-label-sm text-[13px] font-normal leading-snug text-white shadow-md"
        >
          {texte}
        </span>
      )}
    </span>
  );
}
