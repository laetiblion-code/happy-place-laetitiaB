import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Aide à la rédaction d'une actualité depuis un lien ou un PDF (T8, EP10).
// Rien n'est enregistré ni publié ici : la proposition remplit seulement le formulaire, à relire.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MESSAGE_PAR_DEFAUT =
  "L'aide à la rédaction ne répond pas pour le moment. Réessaie plus tard ou rédige l'actualité toi-même.";

export type PropositionIA = { titre: string; texte: string };
type Mode = "lien" | "pdf";

const boutonSecondaire =
  "min-h-[44px] px-md py-xs bg-white border border-[#28282D] text-[#28282D] font-label-md text-label-md hover:bg-[#EDEBE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28282D] disabled:opacity-50";
const boutonPrincipal =
  "min-h-[44px] px-lg py-xs bg-primary text-on-primary font-label-md text-label-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";
const champ =
  "min-h-[44px] flex-1 bg-card border border-outline-variant focus:border-primary focus:outline-none px-sm py-xs font-body-md";

// Lit le message « erreur » du corps de la réponse en cas d'erreur HTTP
async function messageErreur(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const corps = (await ctx.json()) as { erreur?: unknown };
      if (typeof corps.erreur === "string" && corps.erreur) return corps.erreur;
    } catch {
      /* corps non lisible : message par défaut */
    }
  }
  return MESSAGE_PAR_DEFAUT;
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

export function NewsAiHelper({
  titre,
  texte,
  onProposition,
}: {
  titre: string;
  texte: string;
  onProposition: (p: PropositionIA) => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  // Contenu actuel du formulaire, lu au moment de la réponse (l'appel peut durer 30 secondes)
  const actuel = useRef({ titre, texte });
  useEffect(() => {
    actuel.current = { titre, texte };
  }, [titre, texte]);

  function choisir(m: Mode) {
    setErreur(null);
    setMode((courant) => (courant === m ? null : m));
  }

  async function proposer() {
    if (!mode || enCours) return;
    setErreur(null);
    let body: { mode: Mode; url?: string; pdf_base64?: string };
    try {
      if (mode === "lien") {
        const lien = url.trim();
        if (!lien) return setErreur("Saisis l'adresse du lien.");
        body = { mode: "lien", url: lien };
      } else {
        if (!pdf) return setErreur("Choisis un PDF.");
        body = { mode: "pdf", pdf_base64: await fichierEnBase64(pdf) };
      }
    } catch (e) {
      return setErreur((e as Error).message);
    }

    setEnCours(true);
    try {
      const { data, error } = await supabase.functions.invoke("aide-redaction", { body });
      if (error) return setErreur(await messageErreur(error));
      const p = data as Partial<PropositionIA> | null;
      if (
        !p ||
        typeof p.titre !== "string" ||
        typeof p.texte !== "string" ||
        !p.titre ||
        !p.texte
      ) {
        return setErreur(MESSAGE_PAR_DEFAUT);
      }
      const { titre: titreActuel, texte: texteActuel } = actuel.current;
      if (
        (titreActuel.trim() || texteActuel.trim()) &&
        !window.confirm("Remplacer ton titre et ton texte par la proposition de l'IA ?")
      ) {
        return;
      }
      onProposition({ titre: p.titre, texte: p.texte });
      setMode(null);
      setUrl("");
      setPdf(null);
      if (pdfInput.current) pdfInput.current.value = "";
    } catch {
      setErreur(MESSAGE_PAR_DEFAUT);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section
      aria-labelledby="aide-ia-titre"
      className="space-y-sm border border-outline-variant p-sm"
    >
      <h3 id="aide-ia-titre" className="font-label-md text-label-md text-on-surface-variant">
        AIDE À LA RÉDACTION
      </h3>
      <div className="flex flex-wrap gap-xs">
        <button
          type="button"
          disabled={enCours}
          aria-pressed={mode === "lien"}
          onClick={() => choisir("lien")}
          className={`${boutonSecondaire} ${mode === "lien" ? "bg-[#EDEBE6]" : ""}`}
        >
          Depuis un lien
        </button>
        <button
          type="button"
          disabled={enCours}
          aria-pressed={mode === "pdf"}
          onClick={() => choisir("pdf")}
          className={`${boutonSecondaire} ${mode === "pdf" ? "bg-[#EDEBE6]" : ""}`}
        >
          Depuis un PDF
        </button>
      </div>

      {mode === "lien" && (
        <form
          className="space-y-xs"
          onSubmit={(e) => {
            e.preventDefault();
            proposer();
          }}
        >
          <label
            htmlFor="aide-ia-url"
            className="font-label-sm text-label-sm text-on-surface-variant block"
          >
            Adresse du lien
          </label>
          <div className="flex flex-col sm:flex-row gap-xs">
            <input
              id="aide-ia-url"
              type="url"
              placeholder="https://…"
              value={url}
              disabled={enCours}
              onChange={(e) => setUrl(e.target.value)}
              className={champ}
            />
            <button type="submit" disabled={enCours || !url.trim()} className={boutonPrincipal}>
              Proposer
            </button>
          </div>
        </form>
      )}

      {mode === "pdf" && (
        <div className="space-y-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant block">
            Document PDF (5 Mo max)
          </span>
          <div className="flex flex-wrap items-center gap-xs">
            {/* Champ fichier masqué : le bouton visible l'ouvre et reçoit le focus clavier */}
            <input
              ref={pdfInput}
              id="aide-ia-pdf"
              type="file"
              accept="application/pdf,.pdf"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setErreur(null);
                if (f && f.type !== "application/pdf") {
                  setErreur("Seuls les fichiers PDF sont acceptés.");
                  e.target.value = "";
                  setPdf(null);
                  return;
                }
                if (f && f.size > MAX_PDF_BYTES) {
                  setErreur("Le PDF dépasse 5 Mo.");
                  e.target.value = "";
                  setPdf(null);
                  return;
                }
                setPdf(f);
              }}
            />
            <button
              type="button"
              disabled={enCours}
              onClick={() => pdfInput.current?.click()}
              className={boutonSecondaire}
              aria-describedby="aide-ia-pdf-nom"
            >
              Choisir un PDF
            </button>
            <span
              id="aide-ia-pdf-nom"
              className="text-body-sm text-on-surface-variant wrap-anywhere"
            >
              {pdf ? pdf.name : "Aucun fichier"}
            </span>
            <button
              type="button"
              disabled={enCours || !pdf}
              onClick={proposer}
              className={boutonPrincipal}
            >
              Proposer
            </button>
          </div>
        </div>
      )}

      <p role="status" className="text-body-sm text-on-surface-variant">
        {enCours ? "L'IA prépare une proposition… (jusqu'à 30 secondes)" : ""}
      </p>
      {erreur && (
        <p role="alert" className="text-body-sm text-error">
          {erreur}
        </p>
      )}
    </section>
  );
}
