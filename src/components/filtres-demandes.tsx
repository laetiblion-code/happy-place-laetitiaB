import { buttonVariants } from "@/components/ui/button";
import { CLARIFY_CATEGORY } from "@/components/status-badge";
import type { Submission } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type Filtre = "toutes" | "mes" | "pj" | "retard";

/** « En retard » n'est proposé qu'aux managers et à l'admin (ils traitent les demandes). */
export const FILTRES: { valeur: Filtre; libelle: string; reserveAuxManagers?: boolean }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "mes", libelle: "Mes demandes" },
  { valeur: "pj", libelle: "Avec pièce jointe" },
  { valeur: "retard", libelle: "En retard (+3 j)", reserveAuxManagers: true },
];

/** Demande en attente (ou à clarifier) depuis plus de 3 jours : date en rouge, filtre « En retard ». */
export const SEUIL_ATTENTE_MS = 3 * 24 * 60 * 60 * 1000;

/** Demande en attente de traitement : en attente, ou à clarifier (refusée avec cette catégorie). */
export function demandeEnAttente(s: Submission): boolean {
  return (
    s.status === "en attente" ||
    (s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY)
  );
}

/** En attente (ou à clarifier) depuis plus de 3 jours : même seuil que la date en rouge. */
export function attendLongtemps(s: Submission, maintenant = Date.now()): boolean {
  return demandeEnAttente(s) && maintenant - new Date(s.created_at).getTime() > SEUIL_ATTENTE_MS;
}

/** Le filtre garde-t-il cette demande ? `moi` : adresse de la personne connectée (minuscules). */
export function correspondFiltre(
  s: Submission,
  filtre: Filtre,
  moi: string,
  maintenant = Date.now(),
): boolean {
  if (filtre === "mes") return (s.submitted_by_email ?? "").toLowerCase() === moi;
  if (filtre === "pj") return !!s.attachment_path;
  if (filtre === "retard") return attendLongtemps(s, maintenant);
  return true;
}

/**
 * Barre de filtres des demandes (accueil, page « Demandes du cabinet » et gestion) : boutons à bascule et
 * liste des équipes. Le parent remet à zéro ce qui dépend du filtre (pagination) dans ses gestionnaires.
 */
export function FiltresDemandes({
  filtres,
  filtre,
  onFiltre,
  equipe,
  equipes,
  onEquipe,
  idEquipe,
}: {
  filtres: { valeur: Filtre; libelle: string }[];
  filtre: Filtre;
  onFiltre: (f: Filtre) => void;
  equipe: string;
  equipes: string[];
  onEquipe: (equipe: string) => void;
  /** Identifiant du champ « Équipe » (un par écran). */
  idEquipe: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-sm">
      <div role="group" aria-label="Filtrer les demandes" className="flex flex-wrap gap-xs">
        {filtres.map((f) => (
          <button
            key={f.valeur}
            type="button"
            aria-pressed={filtre === f.valeur}
            onClick={() => onFiltre(f.valeur)}
            className={cn(
              buttonVariants({
                variant: filtre === f.valeur ? "default" : "secondary",
                size: "sm",
              }),
              "min-h-11 text-sm",
            )}
          >
            {f.libelle}
          </button>
        ))}
      </div>
      <label
        htmlFor={idEquipe}
        className="flex min-h-11 min-w-0 max-w-full items-center gap-xs font-label-sm text-sm text-on-surface"
      >
        <span className="shrink-0">Équipe :</span>
        <select
          id={idEquipe}
          name="equipe"
          value={equipe}
          onChange={(e) => onEquipe(e.target.value)}
          className="min-h-11 min-w-0 max-w-full border border-[#8A8A90] bg-card px-sm py-xs font-label-sm text-sm focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <option value="">Toutes</option>
          {equipes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
