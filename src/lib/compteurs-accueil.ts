/**
 * Textes et calculs des trois cartes de compteurs de l'accueil (manager et admin), sans React ni Supabase
 * pour pouvoir être testés seuls. Les chiffres viennent de `home-counts.ts`.
 */
import type { EtatObjectif } from "./objectifs";

const DAY_MS = 86_400_000;
/** Au-delà de ce nombre de jours, une demande en attente est « ancienne » (phrase de retard). */
const SEUIL_RETARD_JOURS = 3;

/** Cible affichée (court, visuel) et lue (long, lecteurs d'écran) pour chaque objectif. */
export const CIBLE_DELAI = { court: "< 2 j", long: "de moins de 2 jours" } as const;
export const CIBLE_ACTUS = { court: "de 70 %", long: "de 70 %" } as const;

/** Suite de la ligne d'objectif (après « Objectif X : »), selon l'état et le rôle. */
export function suiteObjectif(etat: EtatObjectif, admin: boolean): string {
  if (etat === "atteint") return admin ? "on garde le rythme" : "garde le rythme";
  if (etat === "presque") return admin ? "on y est presque" : "tu y es presque";
  return admin ? "on peut le faire" : "tu peux le faire";
}

/** Accord : 0 et 1 au singulier, à partir de 2 au pluriel. Renvoie le libellé seul. */
export function accord(n: number, singulier: string, pluriel: string): string {
  return n > 1 ? pluriel : singulier;
}

/** Grand libellé de la carte « Demandes en attente ». Aucune demande : pas de chiffre. */
export function libelleAttente(n: number): { chiffre: boolean; texte: string } {
  if (n === 0) return { chiffre: false, texte: "Rien n'attend ta décision" };
  return {
    chiffre: true,
    texte: n === 1 ? "attend ta décision" : "attendent ta décision",
  };
}

/**
 * Jours pleins depuis la création, si la demande attend depuis plus de 3 jours ; sinon null.
 * `maintenant` est injectable pour les tests.
 */
export function attenteAncienne(
  createdIso: string,
  maintenant: number = Date.now(),
): number | null {
  const ecart = maintenant - Date.parse(createdIso);
  if (!(ecart > SEUIL_RETARD_JOURS * DAY_MS)) return null;
  return Math.floor(ecart / DAY_MS);
}

/**
 * Nom court de la personne : « Sofia Bernard » devient « Sofia B. ». Sans nom connu (adresse seule),
 * le début de l'adresse, jamais l'adresse entière.
 */
export function nomCourt(complet: string): string {
  const valeur = complet.trim();
  if (valeur.includes("@")) return valeur.split("@")[0] ?? valeur;
  const mots = valeur.split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return mots[0] ?? "";
  const initiale = (mots[mots.length - 1] ?? "").charAt(0).toUpperCase();
  return `${mots[0]} ${initiale}.`;
}

/** Phrase de retard : « Sofia B. attend depuis 8 jours » (le jour est mis en avant par l'appelant). */
export function phraseRetard(nom: string, jours: number): { debut: string; jours: string } {
  return {
    debut: `${nom} attend depuis `,
    jours: `${jours} ${accord(jours, "jour", "jours")}`,
  };
}

/** Grand libellé de la carte « Actualités en attente ». */
export function libelleBrouillons(n: number): string {
  return accord(n, "brouillon", "brouillons");
}

/**
 * Brouillons à publier pour atteindre l'objectif de publication, sur la fenêtre de 30 jours.
 * x = arrondi supérieur de (objectif × t / 100) − p, où p = publiées et t = commencées.
 * Calcul en entiers : 70 × 10 / 100 vaut exactement 7, sans erreur de virgule flottante.
 */
export function brouillonsPourObjectif(
  publiees: number,
  commencees: number,
  objectifPourcent: number,
): number {
  return Math.ceil((objectifPourcent * commencees) / 100) - publiees;
}

/**
 * Phrase d'incitation sous « Actualités en attente ». `nombre` sert au lien « Je publie … ».
 * - x ≤ 0 (objectif atteint) : pas de phrase ;
 * - x > brouillons disponibles : « Publier tes N brouillons te rapproche de l'objectif » (N = brouillons) ;
 * - sinon : « Publier x brouillons suffit pour atteindre l'objectif ».
 * Sans brouillon, aucune phrase (les états vides prennent le relais).
 */
export function incitationPublication(opts: {
  publiees: number;
  commencees: number;
  brouillons: number;
  objectifPourcent: number;
  admin: boolean;
}): { phrase: string | null; nombre: number } {
  const { publiees, commencees, brouillons, objectifPourcent, admin } = opts;
  const x = brouillonsPourObjectif(publiees, commencees, objectifPourcent);
  if (x <= 0 || brouillons === 0) return { phrase: null, nombre: brouillons };
  if (x > brouillons) {
    const n = brouillons;
    if (admin) {
      const phrase =
        n === 1
          ? "Publier le brouillon nous rapproche de l'objectif."
          : `Publier les ${n} brouillons nous rapproche de l'objectif.`;
      return { phrase, nombre: n };
    }
    const phrase =
      n === 1
        ? "Publier ton brouillon te rapproche de l'objectif."
        : `Publier tes ${n} brouillons te rapproche de l'objectif.`;
    return { phrase, nombre: n };
  }
  const phrase =
    x === 1
      ? "Publier 1 brouillon suffit pour atteindre l'objectif."
      : `Publier ${x} brouillons suffit pour atteindre l'objectif.`;
  return { phrase, nombre: x };
}

/** Lien vers les brouillons : « Je publie mes 3 brouillons → » (manager), « Je publie les 3 brouillons → » (admin). */
export function libelleLienBrouillons(nombre: number, admin: boolean): string {
  if (nombre === 1) return admin ? "Je publie le brouillon" : "Je publie mon brouillon";
  return admin ? `Je publie les ${nombre} brouillons` : `Je publie mes ${nombre} brouillons`;
}

/** Détail des alertes ouvertes, en texte : « 1 ouverte, 2 en cours, 2 sous surveillance ». */
export function detailAlertes(c: {
  ouverte: number;
  enCours: number;
  surveillance: number;
}): string[] {
  const morceaux: string[] = [];
  if (c.ouverte > 0) morceaux.push(`${c.ouverte} ${accord(c.ouverte, "ouverte", "ouvertes")}`);
  if (c.enCours > 0) morceaux.push(`${c.enCours} en cours`);
  if (c.surveillance > 0) morceaux.push(`${c.surveillance} sous surveillance`);
  return morceaux;
}
