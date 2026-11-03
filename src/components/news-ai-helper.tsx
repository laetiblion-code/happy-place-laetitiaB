import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useDepotFichier } from "@/components/use-depot-fichier";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Aide à la rédaction d'une actualité depuis un lien ou un PDF (T8, EP10).
// Rien n'est enregistré ni publié ici : la proposition remplit seulement le formulaire, à relire.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
// Limites de public.reserver_appel_ia (supabase/migrations/20261101180000_aide_redaction_ia.sql)
const LIMITE_PERSONNE = 10;
const LIMITE_CABINET = 40;
const MESSAGE_ECHEC =
  "L'assistant n'a pas pu proposer de texte. Réessaie dans un instant, ou écris ton actualité toi-même.";
const MESSAGE_SOURCE_AJOUTEE = "La source sera ajoutée à ton actualité. Tu peux la retirer.";

export type PropositionIA = { titre: string; texte: string };
/** D'où vient la proposition : un lien (ajouté aux liens) ou un PDF (cité à la fin du texte). */
export type SourceProposition = { type: "lien"; url: string } | { type: "pdf"; nom: string };
export type PropositionAvecSource = PropositionIA & { source: SourceProposition };
type SourceChoisie = "lien" | "pdf";
type RequeteSource = { url: string } | { pdf: string; nom: string };

const SOURCES: { id: SourceChoisie; libelle: string; icone: string }[] = [
  { id: "lien", libelle: "Depuis un lien", icone: "link" },
  { id: "pdf", libelle: "Depuis un PDF", icone: "picture_as_pdf" },
];

function Icone({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

function fichierEnBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const data = String(lecteur.result);
      resolve(data.slice(data.indexOf(",") + 1));
    };
    lecteur.onerror = () => reject(new Error("Le fichier n'a pas pu être lu."));
    lecteur.readAsDataURL(f);
  });
}

/** Nombre d'appels déjà faits aujourd'hui par la personne connectée (lignes de ai_requests qu'elle peut lire). */
async function appelsAujourdhui(): Promise<number | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email?.toLowerCase();
    if (!email) return null;
    // La base compte à partir de minuit UTC (date_trunc('day', now()))
    const debut = new Date();
    debut.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_email", email)
      .gte("created_at", debut.toISOString());
    if (error || count === null) return null;
    return count;
  } catch {
    return null;
  }
}

/** Statut HTTP et message « erreur » renvoyés par l'Edge Function, quand ils existent. */
async function detailErreurFonction(
  error: unknown,
): Promise<{ status?: number; message?: string }> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return {};
  try {
    const corps = (await ctx.clone().json()) as { erreur?: unknown };
    return {
      status: ctx.status,
      message: typeof corps.erreur === "string" ? corps.erreur : undefined,
    };
  } catch {
    return { status: ctx.status };
  }
}

/**
 * « Laisse l'IA rédiger un premier jet » : un lien ou un PDF (choix par boutons radio, un seul à la fois),
 * proposition de l'IA à relire, erreur avec « Réessayer ». La proposition ne touche le formulaire qu'après
 * « Utiliser cette proposition » ; la source est alors citée (lien ajouté aux liens, ou PDF cité dans le texte).
 */
export function NewsAiHelper({
  titre,
  texte,
  onProposition,
}: {
  titre: string;
  texte: string;
  /** Applique la proposition au formulaire. Renvoie une ligne d'information à afficher, ou rien. */
  onProposition: (p: PropositionAvecSource) => string | void;
}) {
  const idBase = useId();
  const [source, setSource] = useState<SourceChoisie>("lien");
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [erreurSource, setErreurSource] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [proposition, setProposition] = useState<PropositionAvecSource | null>(null);
  const [echec, setEchec] = useState<{ message: string; reessayer: boolean } | null>(null);
  const [remplacer, setRemplacer] = useState(false);
  const [utilises, setUtilises] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  // Contenu actuel du formulaire, lu au moment de la réponse (l'appel peut durer 30 secondes)
  const actuel = useRef({ titre, texte });
  useEffect(() => {
    actuel.current = { titre, texte };
  }, [titre, texte]);

  function rafraichirQuota() {
    appelsAujourdhui().then(setUtilises);
  }
  useEffect(() => {
    rafraichirQuota();
  }, []);

  function choisirSource(s: SourceChoisie) {
    if (s === source) return;
    setSource(s);
    // Une seule source à la fois : changer de source vide l'autre
    setErreurSource(null);
    setUrl("");
    setPdf(null);
    if (pdfInput.current) pdfInput.current.value = "";
  }

  function surToucheSource(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    // Deux sources : les flèches passent de l'une à l'autre et la sélection suit le focus
    const suivant = (index + 1) % SOURCES.length;
    choisirSource(SOURCES[suivant].id);
    radios.current[suivant]?.focus();
  }

  function choisirPdf(f: File | null | undefined) {
    setErreurSource(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setErreurSource("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setErreurSource("Le PDF dépasse 5 Mo.");
      return;
    }
    setPdf(f);
    if (pdfInput.current) pdfInput.current.value = "";
  }

  const depot = useDepotFichier((f) => choisirPdf(f), enCours);

  async function lancer(requete: RequeteSource, sourceProposee: SourceProposition) {
    setEnCours(true);
    setEchec(null);
    setRemplacer(false);
    setInfo(null);
    try {
      const body =
        "pdf" in requete
          ? { mode: "pdf", pdf_base64: requete.pdf }
          : { mode: "lien", url: requete.url };
      const { data, error } = await supabase.functions.invoke("aide-redaction", { body });
      if (error) {
        const { status, message } = await detailErreurFonction(error);
        // Erreur du client (quota, droits, texte introuvable) : son message, sans « Réessayer » pour le quota
        if (message && status && status < 500) {
          setEchec({ message, reessayer: status !== 429 });
        } else {
          setEchec({ message: MESSAGE_ECHEC, reessayer: true });
        }
        return;
      }
      const p = data as Partial<PropositionIA> | null;
      if (
        !p ||
        typeof p.titre !== "string" ||
        typeof p.texte !== "string" ||
        !p.titre ||
        !p.texte
      ) {
        setEchec({ message: MESSAGE_ECHEC, reessayer: true });
        return;
      }
      setProposition({ titre: p.titre, texte: p.texte, source: sourceProposee });
    } catch {
      setEchec({ message: MESSAGE_ECHEC, reessayer: true });
    } finally {
      setEnCours(false);
      rafraichirQuota();
    }
  }

  async function proposer() {
    if (enCours) return;
    setErreurSource(null);
    if (source === "pdf") {
      if (!pdf) {
        setErreurSource("Ajoute un PDF.");
        return;
      }
      try {
        await lancer(
          { pdf: await fichierEnBase64(pdf), nom: pdf.name },
          { type: "pdf", nom: pdf.name },
        );
      } catch (e) {
        setErreurSource((e as Error).message);
      }
      return;
    }
    const lien = url.trim();
    if (!lien) {
      setErreurSource("Ajoute un lien.");
      return;
    }
    await lancer({ url: lien }, { type: "lien", url: lien });
  }

  function utiliser() {
    if (!proposition) return;
    const { titre: titreActuel, texte: texteActuel } = actuel.current;
    if (titreActuel.trim() || texteActuel.trim()) {
      setRemplacer(true);
      return;
    }
    appliquer();
  }

  function appliquer() {
    if (!proposition) return;
    const retour = onProposition(proposition);
    setInfo(retour || null);
    setProposition(null);
    setRemplacer(false);
    setUrl("");
    setPdf(null);
  }

  const sourcePrete = source === "lien" ? url.trim() !== "" : pdf !== null;
  const restant = utilises === null ? null : Math.max(0, LIMITE_PERSONNE - utilises);
  const idTitre = `${idBase}-titre`;
  const idSousTitre = `${idBase}-sous-titre`;
  const idSourceLibelle = `${idBase}-source`;
  const idLien = `${idBase}-lien`;
  const idErreurSource = `${idBase}-erreur-source`;
  const idFormat = `${idBase}-pdf-format`;

  return (
    <div className="space-y-sm">
      <section
        aria-labelledby={idTitre}
        aria-describedby={idSousTitre}
        className="space-y-sm rounded-md bg-[#F5F4F1] p-md"
      >
        <div className="space-y-xs">
          <h3
            id={idTitre}
            className="flex items-center gap-xs font-label-md text-label-md text-primary"
          >
            <Icone name="auto_awesome" className="text-[20px]" />
            Laisse l'IA rédiger un premier jet pour toi
          </h3>
          <p id={idSousTitre} className="text-body-sm text-on-surface-variant">
            Donne un lien ou un PDF : l'IA propose un titre et un texte, tu relis et tu décides.
          </p>
        </div>

        <div className="space-y-xs">
          <span
            id={idSourceLibelle}
            className="block text-[13px] font-bold uppercase tracking-[0.04em] text-on-surface-variant"
          >
            Source
          </span>
          <div
            role="radiogroup"
            aria-labelledby={idSourceLibelle}
            className="grid grid-cols-1 gap-xs sm:grid-cols-2"
          >
            {SOURCES.map((s, index) => {
              const actif = source === s.id;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    radios.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  tabIndex={actif ? 0 : -1}
                  disabled={enCours}
                  onClick={() => choisirSource(s.id)}
                  onKeyDown={(e) => surToucheSource(e, index)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-xs border px-sm py-xs font-semibold transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
                    actif
                      ? "border-primary bg-primary text-on-primary"
                      : "border-[#8A8A90] bg-card text-on-surface hover:border-primary",
                  )}
                >
                  <Icone name={s.icone} className="text-[18px]" />
                  {s.libelle}
                </button>
              );
            })}
          </div>
        </div>

        {source === "lien" ? (
          <div className="space-y-xs">
            <label htmlFor={idLien} className="sr-only">
              Lien vers un article ou une page
            </label>
            <div className="flex min-h-11 items-center gap-xs border border-[#8A8A90] bg-card px-sm focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <Icone name="link" className="text-[18px] text-on-surface-variant" />
              <input
                id={idLien}
                name="aide-ia-lien"
                type="url"
                placeholder="Lien vers un article ou une page"
                value={url}
                disabled={enCours}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setErreurSource(null);
                }}
                aria-describedby={erreurSource ? idErreurSource : undefined}
                className="min-h-11 min-w-0 flex-1 bg-transparent font-body-md focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Champ fichier masqué : la zone visible l'ouvre et reçoit le focus clavier */}
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => choisirPdf(e.target.files?.[0] ?? null)}
            />
            {pdf ? (
              <div className="flex min-h-11 items-center justify-between gap-sm border border-dashed border-[#8A8A90] bg-card px-sm">
                <span className="flex min-w-0 items-center gap-xs font-body-sm">
                  <Icone name="picture_as_pdf" className="text-[18px] text-on-surface-variant" />
                  <span className="min-w-0 wrap-anywhere">{pdf.name}</span>
                </span>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setPdf(null)}
                  className="min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Retirer le PDF
                </button>
              </div>
            ) : (
              <div
                {...depot.zone}
                data-testid="zone-depot-pdf"
                className={cn(
                  "border border-dashed transition-colors",
                  depot.glisse
                    ? "border-primary border-2 bg-card"
                    : "border-[#8A8A90] bg-transparent",
                )}
              >
                <button
                  type="button"
                  disabled={enCours}
                  aria-describedby={idFormat}
                  onClick={() => pdfInput.current?.click()}
                  className="flex w-full flex-col items-center gap-xs px-md py-md text-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  <Icone name="upload_file" className="text-[24px] text-on-surface-variant" />
                  <span className="font-body-md text-on-surface">
                    {depot.glisse
                      ? "Dépose le PDF ici"
                      : "Glisse un PDF ici, ou clique pour le choisir"}
                  </span>
                  <span id={idFormat} className="text-[13px] text-on-surface-variant">
                    PDF, 5 Mo max.
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {erreurSource && (
          <p
            id={idErreurSource}
            role="alert"
            className="flex items-center gap-xs text-body-sm text-[#A81E25]"
          >
            <Icone name="error" className="text-[16px]" />
            {erreurSource}
          </p>
        )}

        <button
          type="button"
          disabled={enCours || !sourcePrete}
          onClick={proposer}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          <Icone name="auto_awesome" className="text-[18px]" />
          Proposer un titre et un texte avec l'IA
        </button>
        <p className="text-body-sm text-on-surface-variant">
          {`Tu as droit à ${LIMITE_PERSONNE} propositions par jour, et le cabinet à ${LIMITE_CABINET}.`}
          {restant !== null &&
            ` Il te reste ${restant} proposition${restant > 1 ? "s" : ""} aujourd'hui.`}
        </p>
        <p role="status" className="text-body-sm text-on-surface-variant">
          {enCours ? "L'IA prépare une proposition… (jusqu'à 30 secondes)" : ""}
        </p>
      </section>

      {echec && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-sm bg-[#F5D5D4] p-sm text-body-sm text-[#28282D]"
        >
          <span className="flex min-w-0 items-start gap-xs">
            <Icone name="error" className="text-[18px]" />
            <span className="min-w-0">{echec.message}</span>
          </span>
          {echec.reessayer && (
            <button
              type="button"
              disabled={enCours}
              onClick={proposer}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {info && (
        <p role="status" className="text-body-sm text-on-surface">
          {info}
        </p>
      )}

      {proposition && (
        <section
          aria-labelledby={`${idBase}-proposition`}
          className="space-y-sm border border-outline-variant bg-card p-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <h3 id={`${idBase}-proposition`} className="font-label-md text-label-md text-primary">
              Proposition de l'IA, à relire
            </h3>
            <span className="rounded-[4px] bg-[#F0D0BC] px-xs py-[2px] text-[12px] font-bold uppercase tracking-[0.06em] text-[#28282D]">
              Brouillon IA
            </span>
          </div>
          <div className="space-y-xs border border-outline-variant bg-surface-container-low p-sm">
            <p className="font-body-md font-bold text-primary wrap-anywhere">{proposition.titre}</p>
            <p className="whitespace-pre-line font-body-md text-on-surface wrap-anywhere">
              {proposition.texte}
            </p>
          </div>
          <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
            <Icone name="info" className="text-[18px]" />
            {MESSAGE_SOURCE_AJOUTEE}
          </p>

          {remplacer ? (
            <div
              role="group"
              aria-label="Confirmation"
              className="flex flex-wrap items-center gap-sm"
            >
              <p className="text-body-sm text-on-surface">
                Remplacer ton titre et ton texte par la proposition ?
              </p>
              <button
                type="button"
                onClick={appliquer}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={() => setRemplacer(false)}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-sm">
              <button
                type="button"
                onClick={utiliser}
                className={buttonVariants({ variant: "default" })}
              >
                Utiliser cette proposition
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={proposer}
                className={buttonVariants({ variant: "secondary" })}
              >
                Proposer autre chose
              </button>
              <button
                type="button"
                onClick={() => setProposition(null)}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Ignorer
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
