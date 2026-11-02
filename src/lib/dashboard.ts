import { loadBrowserLib } from "@/lib/browser-lib";
import type { Database, Json } from "@/integrations/supabase/types";
import { applyNewsImage, removeNewsImageFile, type MediaDraft, type NewsLink } from "@/lib/news-media";
import { supabase } from "@/integrations/supabase/client";

export const db = supabase;

type Enums = Database["public"]["Enums"];


export type News = {
  id: string;
  title: string;
  body: string | null;
  author: string;
  author_email?: string | null;
  status: string;
  created_at: string;
  image_path?: string | null;
  links?: unknown;
};

export type Submission = {
  id: string;
  author_name: string;
  team: string;
  content: string;
  status: string;
  created_at: string;
  rejection_category?: string | null;
  rejection_note?: string | null;
  submitted_by_email?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  category?: string | null;
  visibility?: string | null;
};

export const REJECTION_CATEGORIES = [
  "à clarifier",
  "en désaccord avec les process",
  "doublon",
  "autre",
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export type Blocker = {
  id: string;
  title: string;
  description: string | null;
  department: string;
  severity: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Metric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  trend: "hausse" | "baisse" | "stable";
  previous_value: number | null;
  updated_at?: string | null;
  delta: number | string | null;
  /** Objectif de fin de semestre, facultatif. */
  target?: number | null;
  /** Vrai : plus haut est mieux (défaut). Faux : plus bas est mieux (délai). */
  higher_is_better?: boolean;
  on_dashboard?: boolean;
  /** Position sur l'accueil, de 1 à 4 (croissant). Vide : classé en dernier, puis par libellé. */
  dashboard_position?: number | null;
};

export const TREND_LABELS: Record<Metric["trend"], string> = {
  hausse: "▲ En hausse",
  baisse: "▼ En baisse",
  stable: "■ Stable",
};

/** Nombre au format français (virgule décimale, espace fine pour les milliers). */
export function formatNumberFr(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("fr-FR", options).format(value);
}

/** Unité écrite en toutes lettres : « j » devient « jours ». Espace insécable avant toute unité. */
function suffixeUnite(unit: string | null | undefined): string {
  if (!unit) return "";
  const u = unit.trim();
  if (!u) return "";
  if (u === "j") return "\u00a0jours";
  return `\u00a0${u}`;
}

export function deltaText(m: Pick<Metric, "delta" | "unit"> | undefined): string {
  if (!m || m.delta == null) return "";
  const delta = Number(m.delta);
  if (!Number.isFinite(delta) || delta === 0) return "";
  const abs = formatNumberFr(Math.abs(delta), { maximumFractionDigits: 1 });
  const sign = delta > 0 ? "+" : "−";
  const unite = m.unit?.trim();
  const suffix = m.unit === "%" ? " pts" : unite === "j" ? " jours" : unite ? ` ${unite}` : "";
  return `${sign}${abs}${suffix}`;
}

/** Valeur d'indicateur : « 40,6 % » (espace insécable avant le %), « 31 jours », « 1 250 ». */
export function formatMetricValue(value: number | string, unit: string | null): string {
  const formatted = formatNumberFr(Number(value), {
    minimumFractionDigits: unit === "%" ? 1 : 0,
    maximumFractionDigits: 1,
  });
  const suffix = unit === "%" ? "\u00a0%" : suffixeUnite(unit);
  return `${formatted}${suffix}`;
}

/** Objectif : « 55 % », « 28 jours », « 75 », « 120 h ». Sans zéros inutiles, contrairement à la valeur. */
export function formatObjectif(target: number | string, unit: string | null): string {
  const formatted = formatNumberFr(Number(target), { maximumFractionDigits: 1 });
  const suffix = unit === "%" ? "\u00a0%" : suffixeUnite(unit);
  return `${formatted}${suffix}`;
}

/** Date courte, absolue : « 27 oct. ». */
export function formatDateCourte(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));
}

export type Tendance = "favorable" | "defavorable" | "stable";

/** Tendance favorable ou défavorable selon le sens de l'indicateur (higher_is_better). Stable est neutre. */
export function evaluerTendance(m: Pick<Metric, "trend" | "higher_is_better">): Tendance {
  if (m.trend === "stable") return "stable";
  const monte = m.trend === "hausse";
  return monte === (m.higher_is_better ?? true) ? "favorable" : "defavorable";
}

/** Ligne de tendance sans le mot « favorable » : « En hausse, +2 pts », « Stable ». */
export function libelleTendance(m: Pick<Metric, "trend" | "delta" | "unit">): string {
  if (m.trend === "stable") return "Stable";
  const sens = m.trend === "hausse" ? "En hausse" : "En baisse";
  const delta = deltaText(m);
  return delta ? `${sens}, ${delta}` : sens;
}

/**
 * Avancement vers l'objectif : ratio entre 0 et 1 (plafonné), et atteint ou non.
 * Plus bas est mieux : remplissage = objectif / valeur, plein dès que la valeur est au niveau de l'objectif.
 */
export function progressionObjectif(
  m: Pick<Metric, "value" | "target" | "higher_is_better">,
): { ratio: number; atteint: boolean } | null {
  if (m.target == null) return null;
  const valeur = Number(m.value);
  const cible = Number(m.target);
  if (!Number.isFinite(valeur) || !Number.isFinite(cible)) return null;
  const hautEstMieux = m.higher_is_better ?? true;
  if (hautEstMieux) {
    const atteint = valeur >= cible;
    const ratio = atteint ? 1 : cible > 0 ? Math.max(0, valeur / cible) : 0;
    return { ratio: Math.min(1, ratio), atteint };
  }
  const atteint = valeur <= cible;
  const ratio = atteint ? 1 : valeur > 0 ? cible / valeur : 0;
  return { ratio: Math.min(1, Math.max(0, ratio)), atteint };
}

export async function fetchNews(): Promise<News[]> {
  const { data, error } = await db
    .from("news")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as News[];
}

export async function saveDraftNews(input: {
  id?: string;
  title: string;
  body: string;
  author: string;
  author_email: string;
  links: NewsLink[];
  media: MediaDraft;
}) {
  const payload = {
    title: input.title,
    body: input.body,
    author: input.author,
    author_email: input.author_email.toLowerCase(),
    status: "brouillon" as const,
    links: input.links as unknown as Json,
  };
  const { data, error } = input.id
    ? await db.from("news").update(payload).eq("id", input.id).select("id").single()
    : await db.from("news").insert(payload).select("id").single();
  if (error) throw error;
  await applyNewsImage(data.id, input.media);
}

export async function publishDraftNews(id: string) {
  const { data, error } = await db
    .from("news")
    .update({ status: "publiée" })
    .eq("id", id)
    .eq("status", "brouillon")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Vous n'avez pas le droit de publier cette actualité.");
}

export async function deleteDraftNews(id: string, imagePath?: string | null) {
  await removeNewsImageFile(imagePath);
  const { data, error } = await db.from("news").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Vous n'avez pas le droit de supprimer cette actualité.");
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .eq("status", "en attente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export async function fetchMySubmissions(email: string): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .ilike("submitted_by_email", email)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Submission[];
}

// Même règle que la badge de statut : une demande refusée « à clarifier » est une clarification demandée.
const CATEGORIE_CLARIFICATION = "à clarifier";

const LIBELLES_STATUT: Record<string, string> = {
  "en attente": "En attente",
  validée: "Validée",
  refusée: "Refusée",
  clarification: "Clarification demandée",
};

export function libelleStatutExport(status: string, rejectionCategory: string | null | undefined) {
  if (status === "refusée" && rejectionCategory === CATEGORIE_CLARIFICATION) return "Clarification demandée";
  return LIBELLES_STATUT[status] ?? status;
}

/**
 * « Création → En attente », « En attente → Validée », « En attente → Clarification demandée » (refus « à clarifier »).
 * Le statut précédent est celui du changement d'avant : sa catégorie de refus est lue sur ce changement.
 */
export function libelleChangement(
  h: Pick<SubmissionStatusHistory, "old_status" | "new_status" | "rejection_category">,
  precedent?: Pick<SubmissionStatusHistory, "new_status" | "rejection_category">,
): string {
  const avant = h.old_status
    ? libelleStatutExport(
        h.old_status,
        precedent?.new_status === h.old_status ? precedent.rejection_category : null,
      )
    : "Création";
  const apres = libelleStatutExport(h.new_status, h.rejection_category);
  return `${avant} → ${apres}`;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function exportMyRecentSubmissions(email: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("submissions")
    .select("created_at,author_name,submitted_by_email,team,content,status,rejection_category")
    .ilike("submitted_by_email", email)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return 0;

  const header = ["Date", "Auteur", "E-mail", "Équipe", "Demande", "Statut"];
  const csv = [
    header.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        new Date(row.created_at).toLocaleString("fr-FR"),
        row.author_name,
        row.submitted_by_email ?? "",
        row.team,
        row.content,
        libelleStatutExport(row.status, row.rejection_category),
      ].map((value) => csvCell(String(value))).join(";"),
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `demandes-30-jours-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return rows.length;
}

export async function reviewSubmission(
  input:
    | { id: string; status: "validée" }
    | { id: string; status: "refusée"; rejection_category: RejectionCategory; rejection_note: string },
) {
  const patch =
    input.status === "refusée"
      ? { status: input.status, rejection_category: input.rejection_category, rejection_note: input.rejection_note.trim() }
      : { status: input.status, rejection_category: null, rejection_note: null };
  const { error } = await db
    .from("submissions")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .neq("status", "RÉSOLU")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

/** Managers de l'équipe de la personne connectée (prénom et nom seulement, sans e-mail). */
export type ManagerEquipe = { team: string; prenom: string; nom: string };

export async function fetchManagersMonEquipe(): Promise<ManagerEquipe[]> {
  const { data, error } = await db.rpc("managers_de_mon_equipe");
  if (error) throw error;
  return (data ?? []) as ManagerEquipe[];
}

export async function fetchResolvedBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .eq("status", "RÉSOLU")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

/**
 * Demandes du cabinet pour « 10 dernières demandes du cabinet » : tous statuts, de la plus récente à la plus
 * ancienne. Les règles d'accès (RLS) décident de ce qui est renvoyé ; rien n'est filtré côté client.
 */
export async function fetchCabinetSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export async function updateBlockerStatus(input: { id: string; status: string }) {
  const { error } = await db
    .from("blockers")
    .update({ status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchMetrics(): Promise<Metric[]> {
  const { data, error } = await db.from("metrics_with_trend").select("*");
  if (error) throw error;
  return (data ?? []) as Metric[];
}

/**
 * Ordre d'affichage sur l'accueil : position croissante, les indicateurs sans position en dernier,
 * puis libellé. Deux indicateurs à la même position sont donc triés par libellé.
 */
export function ordreAccueil(
  a: Pick<Metric, "label" | "dashboard_position">,
  b: Pick<Metric, "label" | "dashboard_position">,
): number {
  const pa = a.dashboard_position ?? Number.POSITIVE_INFINITY;
  const pb = b.dashboard_position ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return a.label.localeCompare(b.label, "fr");
}

/** Indicateurs affichés sur l'accueil (au plus 4), dans l'ordre de `ordreAccueil`. Même liste pour tous les rôles. */
export async function fetchDashboardMetrics(): Promise<Metric[]> {
  const [flags, rows] = await Promise.all([
    db.from("metrics").select("key").eq("on_dashboard", true),
    db.from("metrics_with_trend").select("*"),
  ]);
  if (flags.error) throw flags.error;
  if (rows.error) throw rows.error;
  const cles = new Set((flags.data ?? []).map((f) => f.key));
  return ((rows.data ?? []) as Metric[])
    .filter((m) => cles.has(m.key))
    .sort(ordreAccueil);
}

/** Indicateur affiché sur l'accueil (true/false) par clé, pour la gestion. */
export async function fetchMetricFlags(): Promise<Map<string, boolean>> {
  const { data, error } = await db.from("metrics").select("key, on_dashboard");
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.key, m.on_dashboard]));
}

/** Change l'affichage sur l'accueil. La base refuse un 5e indicateur : son message est remonté tel quel. */
export async function setMetricOnDashboard(key: string, onDashboard: boolean) {
  const { error } = await db.from("metrics").update({ on_dashboard: onDashboard }).eq("key", key);
  if (error) throw error;
}

export async function updateMetric(input: { key: string; value: number }) {
  const { error } = await db
    .from("metrics")
    .update({ value: input.value, updated_at: new Date().toISOString() })
    .eq("key", input.key);
  if (error) throw error;
}

/**
 * Durée écoulée, décomposée pour l'affichage court : « 5 j », « 18 h ». Les minutes et l'instant restent
 * écrits en toutes lettres. Même arrondi que `delaiTexte`.
 */
export type DureeEcoulee =
  | { unite: "instant" }
  | { unite: "minute"; n: number }
  | { unite: "heure"; n: number }
  | { unite: "jour"; n: number };

export function decomposerDuree(iso: string, maintenant: number = Date.now()): DureeEcoulee {
  const min = Math.round((maintenant - new Date(iso).getTime()) / 60000);
  if (min < 1) return { unite: "instant" };
  if (min < 60) return { unite: "minute", n: min };
  const h = Math.round(min / 60);
  if (h < 24) return { unite: "heure", n: h };
  return { unite: "jour", n: Math.round(h / 24) };
}

/** Durée écoulée depuis une date, sans préfixe : « 5 jours », « 2 heures », « moins d'une minute ». */
export function delaiTexte(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "moins d'une minute";
  if (min < 60) return `${min} minute${min > 1 ? "s" : ""}`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} heure${h > 1 ? "s" : ""}`;
  const jours = Math.round(h / 24);
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

/** Dernier changement de statut de chaque demande (historique), par identifiant de demande. */
export async function fetchLastStatusChanges(
  ids: string[],
): Promise<Map<string, { new_status: string; changed_at: string }>> {
  const derniers = new Map<string, { new_status: string; changed_at: string }>();
  if (ids.length === 0) return derniers;
  const { data, error } = await db
    .from("submission_status_history")
    .select("submission_id, new_status, changed_at")
    .in("submission_id", ids)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  for (const h of data ?? []) {
    if (!derniers.has(h.submission_id))
      derniers.set(h.submission_id, { new_status: h.new_status, changed_at: h.changed_at });
  }
  return derniers;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} minute${min > 1 ? "s" : ""}`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} heure${h > 1 ? "s" : ""}`;
  const days = Math.round(h / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

/* ============================================================
 * CRUD complet — news / submissions / blockers / metrics
 * ========================================================== */

export type NewsInput = { title: string; body: string; author: string; status: string; links?: NewsLink[] };
export type SubmissionInput = {
  author_name: string;
  team: string;
  content: string;
  status: string;
  category?: string | null;
  visibility?: string | null;
  rejection_category?: string | null;
  rejection_note?: string | null;
};
export type BlockerInput = {
  title: string;
  description: string;
  department: string;
  severity: string;
  status: string;
};
export type MetricInput = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  target: number | null;
  higher_is_better: boolean;
  dashboard_position?: number | null;
};

export async function fetchAllNews(): Promise<News[]> {
  const { data, error } = await db
    .from("news")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as News[];
}

function newsRow(input: NewsInput) {
  return { ...input, links: (input.links ?? []) as unknown as Json, status: input.status as Enums["news_status"] };
}

/** Admin : crée l'actualité (pour obtenir son id), puis envoie l'image. */
export async function createNews(input: NewsInput, media?: MediaDraft) {
  const { data, error } = await db.from("news").insert(newsRow(input)).select("id").single();
  if (error) throw error;
  if (media) await applyNewsImage(data.id, media);
}

export async function updateNews(id: string, input: NewsInput, media?: MediaDraft) {
  const { error } = await db.from("news").update(newsRow(input)).eq("id", id);
  if (error) throw error;
  if (media) await applyNewsImage(id, media);
}

export async function deleteNews(id: string, imagePath?: string | null) {
  await removeNewsImageFile(imagePath);
  const { error } = await db.from("news").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

function submissionRow(input: SubmissionInput) {
  const rejected = input.status === "refusée";
  return {
    author_name: input.author_name,
    team: input.team,
    content: input.content,
    status: input.status as Enums["submission_status"],
    category: (input.category || null) as Enums["submission_category"] | null,
    visibility: input.visibility ? (input.visibility as Enums["submission_visibility"]) : undefined,
    rejection_category: rejected ? ((input.rejection_category || null) as Enums["rejection_category"] | null) : null,
    rejection_note: rejected ? input.rejection_note?.trim() || null : null,
  };
}

export async function createSubmission(input: SubmissionInput) {
  const { error } = await db.from("submissions").insert(submissionRow(input));
  if (error) throw error;
}

export const ATTACHMENT_BUCKET = "submission-attachments";
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function submitIdea(input: Omit<SubmissionInput, "status">, file?: File | null) {
  if (!input.category) throw new Error("Choisis un type de demande.");
  let attachment_path: string | null = null;
  let attachment_name: string | null = null;
  if (file) {
    if (file.type !== "application/pdf") throw new Error("Seuls les fichiers PDF sont acceptés.");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Le fichier dépasse 20 Mo.");
    const { data: u } = await db.auth.getUser();
    if (!u.user) throw new Error("Session expirée");
    attachment_path = `${u.user.id}/${crypto.randomUUID()}.pdf`;
    attachment_name = file.name.slice(0, 200);
    const { error: upErr } = await db.storage
      .from(ATTACHMENT_BUCKET)
      .upload(attachment_path, file, { contentType: "application/pdf" });
    if (upErr) throw upErr;
  }
  const { error } = await db.from("submissions").insert({
    author_name: input.author_name, team: input.team, content: input.content, status: "en attente",
    category: input.category as Enums["submission_category"],
    visibility: (input.visibility ?? "privée") as Enums["submission_visibility"],
    attachment_path, attachment_name,
  });
  if (error) throw error;
}

export async function downloadAttachment(path: string, name: string | null) {
  const { data, error } = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60, {
    download: name ?? true,
  });
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function updateSubmission(id: string, input: SubmissionInput) {
  const { error } = await db.from("submissions").update(submissionRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteSubmission(id: string) {
  const { error } = await db.from("submissions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

export async function createBlocker(input: BlockerInput) {
  const { error } = await db
    .from("blockers")
    .insert({ ...input, severity: input.severity as Enums["blocker_severity"], status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function updateBlocker(id: string, input: BlockerInput) {
  const { error } = await db
    .from("blockers")
    .update({ ...input, severity: input.severity as Enums["blocker_severity"], status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBlocker(id: string) {
  const { error } = await db.from("blockers").delete().eq("id", id);
  if (error) throw error;
}

export async function createMetric(input: MetricInput) {
  const { error } = await db.from("metrics").insert(input);
  if (error) throw error;
}

export async function updateMetricRow(key: string, input: MetricInput) {
  const { error } = await db
    .from("metrics")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}

export async function deleteMetric(key: string) {
  const { error } = await db.from("metrics").delete().eq("key", key);
  if (error) throw error;
}

export type SubmissionStatusHistory = {
  id: string;
  submission_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_email: string | null;
  changed_by_name: string | null;
  is_automatic: boolean;
  rejection_category: string | null;
  rejection_note: string | null;
  changed_at: string;
};

export async function fetchSubmissionHistory(submissionId: string): Promise<SubmissionStatusHistory[]> {
  const { data, error } = await supabase
    .from("submission_status_history")
    .select("*")
    .eq("submission_id", submissionId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionStatusHistory[];
}

export type MetricHistoryPoint = { id: string; metric_key: string; value: number; recorded_at: string };

export async function fetchMetricHistory(key: string): Promise<MetricHistoryPoint[]> {
  const { data, error } = await supabase
    .from("metrics_history")
    .select("*")
    .eq("metric_key", key)
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as MetricHistoryPoint[];
}

/** Supprime du stockage les pièces jointes échues de la file. Renvoie supprimés et restants. */
export async function processAttachmentDeletionQueue(): Promise<{ deleted: number; remaining: number }> {
  const { data, error } = await supabase
    .from("attachment_deletion_queue")
    .select("id, path")
    .lte("delete_after", new Date().toISOString());
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { deleted: 0, remaining: 0 };
  const { data: removed, error: rmError } = await supabase.storage
    .from("submission-attachments")
    .remove(rows.map((r) => r.path));
  if (rmError) {
    await supabase
      .from("attachment_deletion_queue")
      .update({ last_error: rmError.message })
      .in("id", rows.map((r) => r.id));
    return { deleted: 0, remaining: rows.length };
  }
  const removedSet = new Set((removed ?? []).map((o) => o.name));
  const done = rows.filter((r) => removedSet.has(r.path));
  const missing = rows.filter((r) => !removedSet.has(r.path));
  // Fichiers que remove() n'a pas renvoyés : vérifier s'ils existent encore dans le bucket.
  // S'ils sont déjà absents, ils sont considérés comme supprimés. Si l'appel `list`
  // échoue, on ne peut pas conclure : le fichier reste dans la file avec l'erreur.
  const stillThere: { id: string; path: string; errorMessage: string }[] = [];
  for (const r of missing) {
    const slash = r.path.lastIndexOf("/");
    const folder = slash >= 0 ? r.path.slice(0, slash) : "";
    const fileName = slash >= 0 ? r.path.slice(slash + 1) : r.path;
    const { data: listing, error: listError } = await supabase.storage
      .from("submission-attachments")
      .list(folder, { search: fileName, limit: 100 });
    if (listError) {
      stillThere.push({ id: r.id, path: r.path, errorMessage: listError.message });
    } else if ((listing ?? []).some((o) => o.name === fileName)) {
      stillThere.push({ id: r.id, path: r.path, errorMessage: "Fichier non supprimé par le stockage" });
    } else {
      done.push(r);
    }
  }
  if (done.length) {
    const donePaths = done.map((r) => r.path);
    const { error: linkError } = await supabase
      .from("submissions")
      .update({ attachment_path: null, attachment_name: null })
      .in("attachment_path", donePaths);
    if (linkError) throw linkError;
    const { error: delError } = await supabase
      .from("attachment_deletion_queue")
      .delete()
      .in("id", done.map((r) => r.id));
    if (delError) throw delError;
  }
  if (stillThere.length) {
    for (const r of stillThere) {
      await supabase
        .from("attachment_deletion_queue")
        .update({ last_error: r.errorMessage })
        .eq("id", r.id);
    }
  }
  return { deleted: done.length, remaining: stillThere.length };
}

export async function countAttachmentDeletionQueue(): Promise<number> {
  const { count, error } = await supabase
    .from("attachment_deletion_queue")
    .select("id", { count: "exact", head: true })
    .lte("delete_after", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

export type DepartureDocument = {
  submission_id: string;
  path: string;
  name: string | null;
  created_at: string;
  excerpt: string;
};

export type DepartureNotice = {
  id: string;
  departing_label: string;
  departure_date: string;
  kind: "préavis" | "sans préavis";
  documents: DepartureDocument[];
  created_at: string;
  reminder_at: string | null;
};

export async function fetchMyDepartureNotices(email: string): Promise<DepartureNotice[]> {
  const { data, error } = await supabase
    .from("departure_notices")
    .select("id, departing_label, departure_date, kind, documents, created_at, reminder_at")
    .eq("recipient_email", email.toLowerCase())
    .is("closed_at", null)
    .is("downloaded_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DepartureNotice[];
}

export async function markDepartureNoticeDownloaded(id: string) {
  const { error } = await supabase.rpc("mark_departure_notice_downloaded", { _id: id });
  if (error) throw error;
}

export async function downloadDepartureZip(notice: DepartureNotice) {
  const JSZip = await loadBrowserLib<typeof import("jszip")>("/vendor/jszip-3.10.2.min.js", "JSZip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const d of notice.documents) {
    const { data, error } = await supabase.storage.from("submission-attachments").download(d.path);
    if (error) throw error;
    const safe = d.excerpt.replace(/[\\/:*?"<>|\n\r]+/g, " ").trim().slice(0, 60) || "document";
    let name = `${d.created_at.slice(0, 10)} - ${safe}.pdf`;
    let i = 2;
    while (used.has(name)) name = `${d.created_at.slice(0, 10)} - ${safe} (${i++}).pdf`;
    used.add(name);
    zip.file(name, data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documents - ${notice.departing_label}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
