import {
  CATEGORIE_CLARIFICATION,
  libelleChangement,
  type SubmissionStatusHistory,
} from "@/lib/dashboard";
import { nomAffiche } from "@/lib/noms";
import { teamKey, type AdminDirectory } from "@/lib/home-counts";

/** « 02/11/2026 15:58 » */
const fmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Marqueur ajouté au texte de la demande par « Compléter ma demande ». */
export const MARQUEUR_REPONSE = "Réponse à la clarification : ";

/** Réponses données aux clarifications, dans l'ordre (la plus ancienne d'abord), lues dans le texte. */
export function reponsesClarification(contenu: string): string[] {
  return contenu
    .split(MARQUEUR_REPONSE)
    .slice(1)
    .map((r) => r.trim());
}

export type Ligne = { id: string; quand: string; titre: string; detail?: string };

export type OptionsHistorique = {
  /** Adresse de la personne connectée : ses actions s'affichent « toi ». */
  moi?: string;
  /** Prénoms des managers de l'équipe : « Kesha et Sophie ». */
  attenteChez?: string;
  /** Texte de la demande, pour retrouver la réponse à chaque complément. */
  contenu?: string;
  noms: Map<string, string> | undefined;
};

function estMoi(h: SubmissionStatusHistory, moi?: string) {
  return !!moi && (h.changed_by_email ?? "").toLowerCase() === moi.toLowerCase();
}

/** Qui a agi : « toi », le prénom (« Kesha ») côté collaborateur, le nom complet en gestion. */
function acteur(h: SubmissionStatusHistory, { moi, noms }: OptionsHistorique) {
  if (estMoi(h, moi)) return "toi";
  if (h.changed_by_email) {
    const nom = nomAffiche(h.changed_by_email, noms);
    // Côté collaborateur, une adresse sans nom connu n'est jamais affichée : « un manager »
    if (!moi) return nom;
    if (nom.includes("@")) return "un manager";
    return nom.split(/\s+/)[0] ?? nom;
  }
  return h.changed_by_name ?? "Non renseigné";
}

/** Transforme les lignes brutes en phrases claires, dans le même ordre (plus récent d'abord). */
export function lignesHistorique(
  rows: SubmissionStatusHistory[],
  options: OptionsHistorique,
): Ligne[] {
  const { moi, attenteChez, contenu } = options;
  const reponses = contenu ? reponsesClarification(contenu) : [];
  const attente = attenteChez ? `en attente chez ${attenteChez}` : "en attente";

  // Chaque complément (refusée → en attente, par l'auteur) reprend la réponse suivante du texte
  const rangReponse = new Map<string, number>();
  let rang = 0;
  for (const h of [...rows].reverse()) {
    if (isComplement(h)) rangReponse.set(h.id, rang++);
  }

  return rows.map((h, i) => {
    const precedent = rows[i + 1];
    const quand = fmt.format(new Date(h.changed_at));
    const par = acteur(h, options);
    const base = { id: h.id, quand };

    if (h.old_status === null) {
      // Demande d'un manager ou d'un admin : validée dès l'envoi, elle n'attend personne
      if (h.new_status === "validée") return { ...base, titre: "Envoyée · validée à l'envoi" };
      return { ...base, titre: `Envoyée · ${attente}` };
    }
    if (h.is_automatic && h.new_status === "en attente") {
      return { ...base, titre: `Repassée ${attente} (revalidation annuelle)` };
    }
    if (h.new_status === "refusée" && h.rejection_category === CATEGORIE_CLARIFICATION) {
      return {
        ...base,
        titre: `Clarification demandée par ${par}`,
        detail: `Question : ${h.rejection_note ?? ""}`,
      };
    }
    if (h.new_status === "refusée" && h.rejection_category) {
      return {
        ...base,
        titre: `Refusée par ${par}`,
        detail: `Motif : ${h.rejection_category}${h.rejection_note ? `. ${h.rejection_note}` : ""}`,
      };
    }
    if (h.new_status === "validée") {
      return { ...base, titre: `Validée par ${par}` };
    }
    if (isComplement(h)) {
      const index = rangReponse.get(h.id) ?? 0;
      const texte = reponses[index] ?? reponses[reponses.length - 1];
      return {
        ...base,
        titre: `Complétée par ${par} · ${attente}`,
        detail: texte ? `${moi ? "Ta réponse" : "Réponse"} : ${texte}` : undefined,
      };
    }
    return {
      ...base,
      titre: `${libelleChangement(h, precedent)}${h.is_automatic ? " · automatique" : ""}`,
    };
  });
}

/**
 * Où une demande attend, pour l'historique de la gestion : les managers de son équipe, par prénom et nom
 * (« Kesha Martin et Sophie Marchand »), ou « l'admin » si l'équipe n'a pas de manager. Undefined tant que
 * l'annuaire n'est pas chargé.
 */
export function attenteDeEquipe(
  team: string,
  annuaire: AdminDirectory | undefined,
): string | undefined {
  if (!annuaire) return undefined;
  const cle = teamKey(team);
  const noms = annuaire.users
    .filter((u) => u.role === "manager" && u.managedTeams.some((t) => teamKey(t) === cle))
    .map((u) => {
      const nom = [u.first_name, u.last_name].map((p) => p?.trim() ?? "").filter(Boolean).join(" ");
      return nom || u.email;
    });
  if (noms.length === 0) return "l'admin";
  if (noms.length === 1) return noms[0];
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Un complément : la demande repasse de « refusée » à « en attente » par son auteur (pas une revalidation). */
export function isComplement(h: SubmissionStatusHistory) {
  return h.old_status === "refusée" && h.new_status === "en attente" && !h.is_automatic;
}

/**
 * Découpe le texte enregistré : ce qui précède la première « Réponse à la clarification : » est le texte de la
 * demande ; ce qui suit la dernière est la réponse la plus récente. Les réponses intermédiaires restent dans le
 * texte enregistré (base, export, gestion), mais ne sont pas affichées comme texte de la demande.
 */
export function decouperContenu(contenu: string): { texte: string; reponse: string | null } {
  const premier = contenu.indexOf(MARQUEUR_REPONSE);
  if (premier < 0) return { texte: contenu.trim(), reponse: null };
  const dernier = contenu.lastIndexOf(MARQUEUR_REPONSE);
  return {
    texte: contenu.slice(0, premier).trim(),
    reponse: contenu.slice(dernier + MARQUEUR_REPONSE.length).trim(),
  };
}

export type Echange = {
  /** Texte de la demande, sans les réponses. */
  texte: string;
  /** Dernière question du manager (historique « refusée à clarifier »). */
  question: { email: string | null; texte: string; quand: string } | null;
  /** Dernière réponse de l'auteur, seulement si elle est postérieure à la question. */
  reponse: { texte: string; quand: string } | null;
};

/**
 * Question et réponse les plus récentes d'une demande. `rows` : historique du plus récent au plus ancien.
 * Sans historique, la question peut être lue sur la demande elle-même (`fallbackQuestion`).
 */
export function echangeClarification(
  contenu: string,
  rows: SubmissionStatusHistory[],
  fallbackQuestion?: { texte: string; quand: string },
): Echange {
  const { texte, reponse } = decouperContenu(contenu);
  const ligneQuestion = rows.find(
    (h) => h.new_status === "refusée" && h.rejection_category === CATEGORIE_CLARIFICATION,
  );
  const question = ligneQuestion
    ? { email: ligneQuestion.changed_by_email, texte: ligneQuestion.rejection_note ?? "", quand: ligneQuestion.changed_at }
    : fallbackQuestion
      ? { email: null, ...fallbackQuestion }
      : null;
  const derniereReponse = rows.find(isComplement);
  const reponseAffichee =
    reponse && question && derniereReponse && new Date(derniereReponse.changed_at) > new Date(question.quand)
      ? { texte: reponse, quand: derniereReponse.changed_at }
      : null;
  return { texte, question, reponse: reponseAffichee };
}
