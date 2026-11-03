import { supabase } from "@/integrations/supabase/client";
import { formatNumberFr, type Submission } from "@/lib/dashboard";

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
  return `${formatNumberFr(n)} ${noun(n, singular, pluralForm)}`;
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

// --- Admin : écarts d'organisation et annuaire ----------------------------

/** Une personne de la liste blanche, comme l'admin la voit (RLS admin). */
export type AdminDirectoryUser = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  role: string | null;
  managedTeams: string[];
};

export type AdminDirectory = {
  teams: { name: string; is_reserved: boolean }[];
  users: AdminDirectoryUser[];
};

export type AdminGaps = {
  /** Équipes (hors réservée « Admin ») sans aucun manager, avec leur nombre de personnes. */
  teamsWithoutManager: { name: string; personnes: number }[];
  /** Collaborateurs de la liste blanche sans équipe. */
  usersWithoutTeam: number;
};

/** Même normalisation que private.team_has_manager : casse et espaces de bord ignorées. */
export function teamKey(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Calcul pur des écarts à partir de l'annuaire. Une équipe a un manager seulement si une personne au rôle
 * « manager » lui est rattachée (règle de private.team_has_manager).
 */
export function computeAdminGaps(dir: AdminDirectory): AdminGaps {
  const managed = new Set(
    dir.users.filter((u) => u.role === "manager").flatMap((u) => u.managedTeams.map(teamKey)),
  );
  const teamsWithoutManager = dir.teams
    .filter((t) => !t.is_reserved && teamKey(t.name) !== "admin" && !managed.has(teamKey(t.name)))
    .map((t) => ({
      name: t.name,
      personnes: dir.users.filter((u) => u.team && teamKey(u.team) === teamKey(t.name)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  const usersWithoutTeam = dir.users.filter(
    (u) => !u.team && (u.role ?? "collaborateur") === "collaborateur",
  ).length;
  return { teamsWithoutManager, usersWithoutTeam };
}

/** Lit les équipes et les utilisateurs déjà lisibles par l'admin (RLS admin). */
export async function fetchAdminDirectory(): Promise<AdminDirectory> {
  const [teamsRes, usersRes] = await Promise.all([
    supabase.from("teams").select("name, is_reserved"),
    supabase
      .from("allowed_users")
      .select("email, first_name, last_name, team, allowed_user_roles(role), manager_teams(team)"),
  ]);
  if (teamsRes.error) throw teamsRes.error;
  if (usersRes.error) throw usersRes.error;
  return {
    teams: teamsRes.data ?? [],
    users: (usersRes.data ?? []).map((u) => ({
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      team: u.team,
      role: u.allowed_user_roles?.role ?? null,
      managedTeams: (u.manager_teams ?? []).map((m) => m.team),
    })),
  };
}

// --- Objectifs du trimestre (compteurs de l'accueil) -------------------------

const DECISIONS = ["validée", "refusée"] as const;
const LOT_IDS = 100;
/** Fenêtre glissante des compteurs d'objectifs : les 30 derniers jours. */
const FENETRE_MS = 30 * DAY_MS;

export type DelaiValidation = {
  /** Délai moyen en jours calendaires, une décimale. */
  jours: number;
  /** Nombre de demandes prises en compte. */
  nb: number;
};

/**
 * Délai moyen de validation sur 30 jours (même définition que K3.1) : jours calendaires entre la création
 * d'une demande de collaborateur et sa première décision (validée ou refusée), pour les demandes décidées
 * dans les 30 derniers jours. Les demandes de manager et d'admin sont validées dès l'envoi : elles n'ont pas
 * d'historique « en attente », donc elles sont exclues.
 *
 * Décision du 2026-11-03 (remplace celle du 2026-10-30) : la première décision, validée, refusée ou
 * clarification demandée, termine le délai. Les demandes passées par une clarification ne sont plus exclues.
 *
 * Périmètre : `teams` = équipes gérées par le manager, null pour l'admin. L'admin lit tout ce que la RLS
 * lui laisse voir : la RLS ne lui montre pas les demandes privées des équipes qui ont un manager. Le délai
 * du cabinet ne compte donc pas ces demandes-là ; il n'y a pas de règle de périmètre supplémentaire ici.
 */
export async function fetchDelaiValidation(
  teams: string[] | null,
): Promise<DelaiValidation | null> {
  if (teams && teams.length === 0) return null;
  const debut = new Date(Date.now() - FENETRE_MS).toISOString();
  const { data: decidees, error: e1 } = await supabase
    .from("submission_status_history")
    .select("submission_id")
    .eq("old_status", "en attente")
    .in("new_status", [...DECISIONS])
    .gte("changed_at", debut);
  if (e1) throw e1;
  const ids = [...new Set((decidees ?? []).map((h) => h.submission_id))];
  if (ids.length === 0) return null;

  // Première décision de chaque demande, depuis sa création (pas seulement depuis le début de la fenêtre)
  const premiere = new Map<string, string>();
  for (let i = 0; i < ids.length; i += LOT_IDS) {
    const { data, error } = await supabase
      .from("submission_status_history")
      .select("submission_id, changed_at")
      .eq("old_status", "en attente")
      .in("new_status", [...DECISIONS])
      .in("submission_id", ids.slice(i, i + LOT_IDS))
      .order("changed_at", { ascending: true });
    if (error) throw error;
    for (const h of data ?? [])
      if (!premiere.has(h.submission_id)) premiere.set(h.submission_id, h.changed_at);
  }

  // Dates de création des demandes décidées (les équipes gérées seulement, pour le manager)
  const creation = new Map<string, string>();
  for (let i = 0; i < ids.length; i += LOT_IDS) {
    let q = supabase
      .from("submissions")
      .select("id, created_at, team")
      .in("id", ids.slice(i, i + LOT_IDS));
    if (teams) q = q.in("team", teams);
    const { data, error } = await q;
    if (error) throw error;
    for (const s of data ?? []) creation.set(s.id, s.created_at);
  }
  return calculerDelaiValidation(premiere, creation, Date.parse(debut));
}

/**
 * Moyenne des délais calendaires entre la création de chaque demande et sa première décision, pour les
 * décisions datées à partir de `debutMs`. `premiere` : première décision (ISO) par demande ; `creation` :
 * date de création par demande (une demande absente, par exemple hors périmètre, est ignorée).
 */
export function calculerDelaiValidation(
  premiere: Map<string, string>,
  creation: Map<string, string>,
  debutMs: number,
): DelaiValidation | null {
  const jours: number[] = [];
  for (const [id, decision] of premiere) {
    const cree = creation.get(id);
    if (!cree) continue;
    const decideMs = new Date(decision).getTime();
    if (decideMs < debutMs) continue;
    jours.push((decideMs - new Date(cree).getTime()) / DAY_MS);
  }
  if (jours.length === 0) return null;
  const moyenne = jours.reduce((a, b) => a + b, 0) / jours.length;
  return { jours: Math.round(moyenne * 10) / 10, nb: jours.length };
}

export type PublicationActus = {
  /** Actualités créées dans les 30 derniers jours, tous statuts. */
  commencees: number;
  /** Parmi elles, les publiées. */
  publiees: number;
};

/**
 * Actualités créées dans les 30 derniers jours : publiées et toutes. Sans e-mail : tout le cabinet (admin).
 * Avec e-mail : ses seules actualités (manager).
 */
export async function fetchPublicationActus(
  email: string | null = null,
): Promise<PublicationActus> {
  let requete = supabase
    .from("news")
    .select("status")
    .gte("created_at", new Date(Date.now() - FENETRE_MS).toISOString());
  if (email) requete = requete.eq("author_email", email.toLowerCase());
  const { data, error } = await requete;
  if (error) throw error;
  const rows = data ?? [];
  return { commencees: rows.length, publiees: rows.filter((n) => n.status === "publiée").length };
}
