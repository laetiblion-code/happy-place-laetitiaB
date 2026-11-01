import { supabase } from "@/integrations/supabase/client";
import type { Submission } from "@/lib/dashboard";

/**
 * Compteurs de la page d'accueil.
 * Chaque compte est un `count: "exact", head: true` soumis aux règles d'accès (RLS) de la personne connectée :
 * le chiffre affiché est donc le nombre de lignes qu'elle voit réellement.
 */

const DAY_MS = 86_400_000;
/** Une demande « à clarifier » est une demande refusée avec cette catégorie (pas de statut dédié). */
const CLARIFY = "à clarifier";

/** Échappe les caractères joker de LIKE/ILIKE pour une comparaison exacte d'adresse e-mail. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Accord français : 0 et 1 au singulier, à partir de 2 au pluriel. Renvoie le libellé seul. */
export function noun(n: number, singular: string, pluralForm: string) {
  return n > 1 ? pluralForm : singular;
}

/** Accord français avec le nombre : « 0 demande », « 2 demandes ». */
export function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${noun(n, singular, pluralForm)}`;
}

function unwrap(res: { count: number | null; error: unknown }) {
  if (res.error) throw res.error;
  return res.count ?? 0;
}

// --- Manager et admin ---------------------------------------------------------

/** Demandes que la personne connectée peut traiter, hors ses propres demandes. */
function reviewable(email: string, teams: string[] | null) {
  let q = supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .or(`submitted_by_email.is.null,submitted_by_email.not.ilike.${escapeLike(email)}`);
  // Manager : seulement les équipes gérées (manager_teams). Admin (teams = null) : tout ce que RLS laisse lire.
  if (teams) q = q.in("team", teams);
  return q;
}

/** Liste « Demandes à traiter » : mêmes filtres que `reviewable`, pour que le badge et la carte restent égaux. */
export async function fetchReviewList(
  email: string,
  teams: string[] | null,
): Promise<Submission[]> {
  if (teams && teams.length === 0) return [];
  let q = supabase
    .from("submissions")
    .select("*")
    .eq("status", "en attente")
    .or(`submitted_by_email.is.null,submitted_by_email.not.ilike.${escapeLike(email)}`);
  if (teams) q = q.in("team", teams);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export type ReviewCounts = {
  /** Demandes en attente. */
  pending: number;
  /** Parmi elles, celles créées il y a plus de 3 jours. */
  pendingOverThreeDays: number;
  /** Demandes à clarifier (refusées avec la catégorie « à clarifier »). */
  toClarify: number;
};

export async function fetchReviewCounts(
  email: string,
  teams: string[] | null,
): Promise<ReviewCounts> {
  if (teams && teams.length === 0) return { pending: 0, pendingOverThreeDays: 0, toClarify: 0 };
  const threshold = new Date(Date.now() - 3 * DAY_MS).toISOString();
  const [pending, pendingOverThreeDays, toClarify] = await Promise.all([
    reviewable(email, teams).eq("status", "en attente").then(unwrap),
    reviewable(email, teams).eq("status", "en attente").lt("created_at", threshold).then(unwrap),
    reviewable(email, teams).eq("status", "refusée").eq("rejection_category", CLARIFY).then(unwrap),
  ]);
  return { pending, pendingOverThreeDays, toClarify };
}

export type DraftCounts = {
  /** Brouillons lisibles (le manager ne voit que les siens, l'admin tous). */
  drafts: number;
  /** Brouillons dont la personne connectée est l'auteure (admin seulement). */
  draftsMine: number;
};

export async function fetchDraftCounts(email: string, isAdmin: boolean): Promise<DraftCounts> {
  const drafts = supabase
    .from("news")
    .select("id", { count: "exact", head: true })
    .eq("status", "brouillon");
  const mine = supabase
    .from("news")
    .select("id", { count: "exact", head: true })
    .eq("status", "brouillon")
    .eq("author_email", email);
  const [d, m] = await Promise.all([
    drafts.then(unwrap),
    isAdmin ? mine.then(unwrap) : Promise.resolve(0),
  ]);
  return { drafts: d, draftsMine: m };
}

export type AlertCounts = {
  /** Alertes non résolues, dans tout le cabinet. */
  open: number;
  ouverte: number;
  enCours: number;
  surveillance: number;
  /** Alertes non résolues de sévérité critique (admin seulement). */
  critical: number;
};

function openBlockers() {
  return supabase
    .from("blockers")
    .select("id", { count: "exact", head: true })
    .neq("status", "RÉSOLU");
}

export async function fetchAlertCounts(isAdmin: boolean): Promise<AlertCounts> {
  const byStatus = (status: "OUVERT" | "EN COURS" | "SURVEILLANCE") =>
    openBlockers().eq("status", status).then(unwrap);
  const [open, ouverte, enCours, surveillance, critical] = await Promise.all([
    openBlockers().then(unwrap),
    byStatus("OUVERT"),
    byStatus("EN COURS"),
    byStatus("SURVEILLANCE"),
    isAdmin ? openBlockers().eq("severity", "critical").then(unwrap) : Promise.resolve(0),
  ]);
  return { open, ouverte, enCours, surveillance, critical };
}

// --- Collaborateur ------------------------------------------------------------

/** Demandes de la personne connectée (même logique que « Mes demandes »). */
function mine(email: string) {
  return supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .ilike("submitted_by_email", escapeLike(email));
}

export type MyCounts = {
  /** Demandes à compléter : refusées avec « à clarifier ». */
  toComplete: number;
  pending: number;
  validated: number;
  /** Refusées, hors « à clarifier ». */
  refused: number;
};

export async function fetchMyCounts(email: string): Promise<MyCounts> {
  const [toComplete, pending, validated, refusedAll] = await Promise.all([
    mine(email).eq("status", "refusée").eq("rejection_category", CLARIFY).then(unwrap),
    mine(email).eq("status", "en attente").then(unwrap),
    mine(email).eq("status", "validée").then(unwrap),
    mine(email).eq("status", "refusée").then(unwrap),
  ]);
  return { toComplete, pending, validated, refused: Math.max(0, refusedAll - toComplete) };
}
