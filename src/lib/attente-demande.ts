import { CLARIFY_CATEGORY } from "@/components/status-badge";
import type { AdminDirectory } from "@/lib/home-counts";
import type { ManagerEquipe, Submission } from "@/lib/dashboard";

/** « a », « a et b », « a, b et c » : liste française. */
export function listeFr(noms: string[]): string {
  if (noms.length <= 1) return noms.join("");
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

const cleEquipe = (nom: string) => nom.trim().toLowerCase();

/** Managers d'une équipe d'après l'annuaire (admin) : prénoms, ou adresse à défaut. */
export function managersAnnuaire(annuaire: AdminDirectory, equipe: string): string[] {
  return annuaire.users
    .filter(
      (u) => u.role === "manager" && u.managedTeams.some((t) => cleEquipe(t) === cleEquipe(equipe)),
    )
    .map((u) => u.first_name?.trim() || u.email);
}

/** Point de vue de la personne connectée. Les listes absentes (pas encore chargées) donnent « pas de chip ». */
export type ContexteAttente =
  | { role: "admin"; annuaire: AdminDirectory | undefined }
  | { role: "manager"; equipesGerees: string[] }
  | { role: "collaborateur"; moi: string; managers: ManagerEquipe[] | undefined };

export type Attente = {
  /** Texte avant « depuis » : « En attente chez Kesha », « À clarifier chez Gontran ». */
  libelle: string;
  /** Demande à clarifier (refusée avec la catégorie de clarification). */
  clarification: boolean;
};

/** Prénom de l'autrice de la demande (premier mot du nom affiché). */
function prenomAuteur(s: Submission): string {
  const nom = s.author_name.trim();
  return nom.split(/\s+/)[0] || nom;
}

/**
 * Où et depuis quand une demande attend : chip « En attente chez … » ou « À clarifier chez … ».
 * Renvoie null pour les demandes validées, refusées, ou que la personne ne doit pas voir en attente
 * (la chip de statut simple reste alors affichée).
 */
export function attenteDemande(s: Submission, ctx: ContexteAttente): Attente | null {
  const clarification = s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY;
  const enAttente = s.status === "en attente";
  if (!clarification && !enAttente) return null;

  if (ctx.role === "collaborateur") {
    if ((s.submitted_by_email ?? "").toLowerCase() !== ctx.moi) return null;
    if (clarification) return { libelle: "À compléter par toi", clarification: true };
    if (!ctx.managers) return null;
    const prenoms = ctx.managers
      .filter((m) => cleEquipe(m.team) === cleEquipe(s.team))
      .map((m) => m.prenom);
    return {
      libelle: `En attente chez ${listeFr(prenoms) || "ton manager"}`,
      clarification: false,
    };
  }

  if (clarification) return { libelle: `À clarifier chez ${prenomAuteur(s)}`, clarification: true };

  if (ctx.role === "manager") {
    const sienne = ctx.equipesGerees.some((t) => cleEquipe(t) === cleEquipe(s.team));
    return sienne ? { libelle: "En attente chez toi", clarification: false } : null;
  }

  // Admin : les managers de l'équipe, « chez toi » si l'équipe n'a pas de manager
  if (!ctx.annuaire) return null;
  const managers = managersAnnuaire(ctx.annuaire, s.team);
  return {
    libelle: `En attente chez ${managers.length ? listeFr(managers) : "toi"}`,
    clarification: false,
  };
}
