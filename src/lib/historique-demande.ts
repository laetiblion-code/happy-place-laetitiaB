import {
  CATEGORIE_CLARIFICATION,
  libelleChangement,
  type SubmissionStatusHistory,
} from "@/lib/dashboard";
import { nomAffiche } from "@/lib/noms";

/** « 02/11/2026 15:58 » */
const fmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Marqueur ajouté au texte de la demande par « Compléter ma demande ». */
const MARQUEUR_REPONSE = "Réponse à la clarification : ";

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
      return { ...base, titre: `Envoyée · ${attente}` };
    }
    if (h.is_automatic && h.new_status === "en attente") {
      return { ...base, titre: "Repassée en attente (revalidation annuelle)" };
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

/** Un complément : la demande repasse de « refusée » à « en attente » par son auteur (pas une revalidation). */
function isComplement(h: SubmissionStatusHistory) {
  return h.old_status === "refusée" && h.new_status === "en attente" && !h.is_automatic;
}
