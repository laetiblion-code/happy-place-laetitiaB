// Happy Place : aide à la rédaction des actualités (T8, EP10)
// Edge Function Supabase « aide-redaction ».
// 1. Vérifie la session et réserve un appel (public.reserver_appel_ia : rôle et plafond quotidien).
// 2. Extrait le texte d'un lien https ou d'un PDF (le fichier ne quitte pas Supabase).
// 3. Envoie seulement ce texte au scénario Make, qui appelle le modèle d'IA.
// 4. Renvoie { titre, texte } à relire. Rien n'est publié automatiquement.
// Secrets à définir dans Supabase > Edge Functions > Secrets :
//   MAKE_WEBHOOK_URL, MAKE_SHARED_SECRET, ALLOWED_ORIGIN (ex. https://happy-place-orpin.vercel.app)
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_CHARS = 12000;
const MIN_SOURCE_CHARS = 200;

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
const erreur = (status: number, message: string) => reponse(status, { erreur: message });

// Refuse les adresses internes : localhost, adresses IP privées ou locales, noms internes
function adresseAutorisee(raw: string): URL | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (!h.includes(".")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return null;
  }
  if (h.includes(":")) return null; // adresses IPv6 littérales refusées
  return url;
}

function texteDepuisHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

async function lireLien(raw: string): Promise<string> {
  const premiere = adresseAutorisee(raw);
  if (!premiere) throw new Error("LIEN_REFUSE");
  let url: URL = premiere;
  // Suit au plus 3 redirections, en revérifiant chaque adresse
  for (let i = 0; i < 4; i++) {
    let r: Response;
    try {
      r = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "HappyPlace/1.0 (aide a la redaction)", "Accept": "text/html,text/plain" },
      });
    } catch {
      throw new Error("LIEN_ILLISIBLE"); // site injoignable ou trop lent
    }
    if (r.status >= 300 && r.status < 400) {
      const next: string | null = r.headers.get("location");
      const suivant: URL | null = next ? adresseAutorisee(new URL(next, url).toString()) : null;
      if (!suivant) throw new Error("LIEN_REFUSE");
      url = suivant;
      continue;
    }
    if (!r.ok) throw new Error("LIEN_ILLISIBLE");
    const type = r.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/i.test(type)) throw new Error("LIEN_ILLISIBLE");
    const reader = r.body?.getReader();
    if (!reader) throw new Error("LIEN_ILLISIBLE");
    const morceaux: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_PAGE_BYTES) { await reader.cancel(); break; }
      morceaux.push(value);
    }
    const tout = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
    let pos = 0;
    for (const m of morceaux) { tout.set(m, pos); pos += m.length; }
    const brut = new TextDecoder().decode(tout);
    return /text\/html/i.test(type) ? texteDepuisHtml(brut) : brut.trim();
  }
  throw new Error("LIEN_REFUSE");
}

async function lirePdf(base64: string): Promise<string> {
  const binaire = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (binaire.length > MAX_PDF_BYTES) throw new Error("PDF_TROP_GROS");
  if (!(binaire[0] === 0x25 && binaire[1] === 0x50 && binaire[2] === 0x44 && binaire[3] === 0x46)) throw new Error("PDF_INVALIDE");
  const pdf = await getDocumentProxy(binaire);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

// Clé publique du projet : ancienne clé « anon » ou nouvelle clé « publishable », selon le projet
// La nouvelle clé « publishable » passe en premier ; l'ancienne clé « anon » (dépréciée) en dernier recours
function clePublique(): string {
  try {
    const cles = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const premiere = cles.default ?? Object.values(cles)[0];
    if (typeof premiere === "string" && premiere) return premiere;
  } catch { /* ignoré */ }
  const directe = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (directe) return directe;
  throw new Error("CLE_PUBLIQUE_ABSENTE");
}

const MESSAGES: Record<string, [number, string]> = {
  LIEN_REFUSE: [400, "Ce lien ne peut pas être lu : utilise une adresse publique qui commence par https://."],
  LIEN_ILLISIBLE: [422, "La page n'a pas pu être lue (accès protégé ou contenu non textuel). Tu peux rédiger l'actualité toi-même."],
  PDF_TROP_GROS: [413, "Le PDF dépasse 5 Mo."],
  PDF_INVALIDE: [400, "Le fichier n'est pas un PDF valide."],
  TEXTE_INSUFFISANT: [422, "La source contient trop peu de texte lisible (PDF scanné ou page vide). Tu peux rédiger l'actualité toi-même."],
  IA_INDISPONIBLE: [502, "L'aide à la rédaction ne répond pas pour le moment. Réessaie plus tard ou rédige l'actualité toi-même."],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return erreur(405, "Méthode non autorisée.");

  const auth = req.headers.get("Authorization");
  if (!auth) return erreur(401, "Connexion requise.");

  let body: { mode?: string; url?: string; pdf_base64?: string };
  try { body = await req.json(); } catch { return erreur(400, "Requête invalide."); }
  const mode = body.mode;
  if (mode !== "lien" && mode !== "pdf") return erreur(400, "Choisis un lien ou un PDF.");

  // 1. Droits et plafond, avec la session de la personne (règles d'accès de la base)
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, clePublique(), {
    global: { headers: { Authorization: auth } },
  });
  const { error: quotaError } = await supabase.rpc("reserver_appel_ia", { _kind: mode });
  if (quotaError) {
    const msg = quotaError.message || "Accès refusé.";
    return erreur(/limite/i.test(msg) ? 429 : 403, msg);
  }

  try {
    // 2. Extraction du texte
    let source = mode === "lien" ? await lireLien(String(body.url ?? "")) : await lirePdf(String(body.pdf_base64 ?? ""));
    if (source.length < MIN_SOURCE_CHARS) throw new Error("TEXTE_INSUFFISANT");
    source = source.slice(0, MAX_SOURCE_CHARS);

    // 3. Appel du scénario Make (le texte seul, avec le secret partagé)
    const r = await fetch(Deno.env.get("MAKE_WEBHOOK_URL")!, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      // Le secret partagé passe dans l'en-tête attendu par le webhook Make (« API Key authentication »),
      // jamais dans le corps : il n'apparaît donc pas dans l'historique des exécutions de Make.
      headers: { "Content-Type": "application/json", "x-make-apikey": Deno.env.get("MAKE_SHARED_SECRET") ?? "" },
      body: JSON.stringify({ source: mode, texte: source }),
    });
    if (!r.ok) throw new Error("IA_INDISPONIBLE");
    let proposition: { titre?: unknown; texte?: unknown };
    try { proposition = await r.json(); } catch { throw new Error("IA_INDISPONIBLE"); }
    const titre = typeof proposition.titre === "string" ? proposition.titre.trim().slice(0, 120) : "";
    const texte = typeof proposition.texte === "string" ? proposition.texte.trim().slice(0, 5000) : "";
    if (!titre || !texte) throw new Error("IA_INDISPONIBLE");

    // 4. Proposition à relire
    return reponse(200, { titre, texte });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const [status, message] = MESSAGES[code] ?? MESSAGES.IA_INDISPONIBLE;
    if (!MESSAGES[code]) console.error("aide-redaction", e);
    return erreur(status, message);
  }
});
