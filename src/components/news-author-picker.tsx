import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialesDe } from "@/lib/noms";

/** Une autrice possible pour une actualité : soi-même (admin) ou un manager. */
export type AuteurPossible = {
  email: string;
  /** Nom enregistré comme auteur de l'actualité (prénom et nom, ou e-mail). */
  nom: string;
  /** Texte de la liste : « Moi (Olivia) » ou « Kesha · Manager Product et Marketing ». */
  libelle: string;
  initiales: string;
};

const normaliser = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Liste des managers pour « Publier au nom de » (admin seulement, lecture de la liste blanche).
 * Le libellé reprend le rôle et les équipes ; aucune équipe n'est proposée seule.
 */
export function useManagersPossibles(actif: boolean) {
  return useQuery({
    queryKey: ["managers-possibles"],
    enabled: actif,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AuteurPossible[]> => {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("email, first_name, last_name, allowed_user_roles(role), manager_teams(team)")
        .order("first_name");
      if (error) throw error;
      return (data ?? [])
        .filter((u) => u.allowed_user_roles?.role === "manager")
        .map((u) => {
          const nom =
            [u.first_name, u.last_name]
              .map((p) => p?.trim() ?? "")
              .filter(Boolean)
              .join(" ") || u.email;
          const equipes = (u.manager_teams ?? []).map((t) => t.team).sort();
          const role = equipes.length ? `Manager ${equipes.join(", ")}` : "Manager";
          return {
            email: u.email.toLowerCase(),
            nom,
            libelle: `${nom} · ${role}`,
            initiales: initialesDe(nom),
          };
        });
    },
  });
}

/**
 * Combobox accessible (ARIA 1.2) : saisie filtrante, flèches, Entrée pour choisir, Échap pour fermer la liste.
 * La première option est toujours la personne connectée (« Moi (…) »).
 */
export function ChoixAuteur({
  options,
  valeur,
  onChoisir,
  note,
  disabled,
  onOuvertChange,
}: {
  options: AuteurPossible[];
  valeur: string;
  onChoisir: (email: string) => void;
  /** Phrase sous le champ (ex. « L'actualité affichera « Kesha, via Olivia (admin) ». »). */
  note: string;
  disabled?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
}) {
  const idBase = useId();
  const idLabel = `${idBase}-label`;
  const idListe = `${idBase}-liste`;
  const idNote = `${idBase}-note`;
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState<string | null>(null);
  const [actif, setActif] = useState(0);

  const selection = options.find((o) => o.email === valeur) ?? options[0];
  const filtrees = useMemo(() => {
    const q = normaliser(recherche ?? "");
    if (!q) return options;
    return options.filter((o) => normaliser(`${o.libelle} ${o.email}`).includes(q));
  }, [options, recherche]);

  function changerOuverture(v: boolean) {
    setOuvert(v);
    onOuvertChange?.(v);
  }

  function choisir(o: AuteurPossible) {
    onChoisir(o.email);
    setRecherche(null);
    changerOuverture(false);
  }

  function surTouche(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      changerOuverture(true);
      setActif((i) => Math.min(i + 1, Math.max(filtrees.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      changerOuverture(true);
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && ouvert && filtrees[actif]) {
      e.preventDefault();
      choisir(filtrees[actif]);
    } else if (e.key === "Escape" && ouvert) {
      // Échap ferme seulement la liste ; la fenêtre reste ouverte (voir news-editor)
      e.preventDefault();
      setRecherche(null);
      changerOuverture(false);
    }
  }

  const optionActive = ouvert && filtrees[actif] ? `${idListe}-${actif}` : undefined;

  return (
    <div className="space-y-xs">
      <label
        id={idLabel}
        htmlFor={`${idBase}-champ`}
        className="block text-[13px] font-bold uppercase tracking-[0.04em] text-on-surface-variant"
      >
        Publier au nom de <span aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="material-symbols-outlined pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
        >
          person
        </span>
        <span
          aria-hidden="true"
          className={`material-symbols-outlined pointer-events-none absolute right-sm top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant transition-transform ${ouvert ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
        <input
          id={`${idBase}-champ`}
          type="text"
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-autocomplete="list"
          aria-required="true"
          aria-activedescendant={optionActive}
          aria-describedby={idNote}
          autoComplete="off"
          disabled={disabled}
          value={recherche ?? selection?.libelle ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setRecherche(e.target.value);
            setActif(0);
            changerOuverture(true);
          }}
          onClick={() => changerOuverture(true)}
          onKeyDown={surTouche}
          onBlur={() => {
            setRecherche(null);
            changerOuverture(false);
          }}
          className="min-h-11 w-full cursor-pointer rounded-[6px] border border-[#8A8A90] bg-card py-xs pl-[40px] pr-[40px] font-body-md text-on-surface hover:border-primary hover:bg-[#F5F4F1] focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
        {ouvert && (
          <ul
            id={idListe}
            role="listbox"
            aria-labelledby={idLabel}
            className="absolute z-10 mt-xs max-h-64 w-full overflow-y-auto border border-[#8A8A90] bg-card shadow-md"
          >
            {filtrees.map((o, i) => (
              <li
                key={o.email}
                id={`${idListe}-${i}`}
                role="option"
                aria-selected={o.email === valeur}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(o)}
                onMouseEnter={() => setActif(i)}
                className={`flex cursor-pointer items-center gap-sm px-sm py-xs ${i === actif ? "bg-[#EDEBE6]" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F5D5D4] text-[13px] font-bold text-[#28282D]"
                >
                  {o.initiales}
                </span>
                <span className="block min-w-0 font-body-md text-on-surface">{o.libelle}</span>
              </li>
            ))}
            {filtrees.length === 0 && (
              <li className="px-sm py-xs text-body-sm italic text-on-surface-variant">
                Aucune personne trouvée.
              </li>
            )}
          </ul>
        )}
      </div>
      <p id={idNote} className="flex items-start gap-xs text-[13px] text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] leading-none">
          info
        </span>
        <span>{note}</span>
      </p>
    </div>
  );
}
