import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Aide à la rédaction d'une actualité depuis un lien ou un PDF (T8, EP10).
// Rien n'est enregistré ni publié ici : la proposition remplit seulement le formulaire, à relire.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MESSAGE_ECHEC =
  "L'assistant n'a pas pu proposer de texte. Réessaie dans un instant, ou écris ton actualité toi-même.";

export type PropositionIA = { titre: string; texte: string };
type Source = { url: string } | { pdf: string; nom: string };

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

/**
 * « Partir d'une source » : lien ou PDF (glisser-déposer ou clic), proposition de l'IA à relire,
 * erreur avec « Réessayer ». La proposition ne touche le formulaire qu'après « Utiliser cette proposition ».
 */
export function NewsAiHelper({
  titre,
  texte,
  onProposition,
}: {
  titre: string;
  texte: string;
  onProposition: (p: PropositionIA) => void;
}) {
  const idBase = useId();
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [glisse, setGlisse] = useState(false);
  const [erreurSource, setErreurSource] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [proposition, setProposition] = useState<PropositionIA | null>(null);
  const [echec, setEchec] = useState(false);
  const [remplacer, setRemplacer] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  // Contenu actuel du formulaire, lu au moment de la réponse (l'appel peut durer 30 secondes)
  const actuel = useRef({ titre, texte });
  useEffect(() => {
    actuel.current = { titre, texte };
  }, [titre, texte]);

  function choisirPdf(f: File | null) {
    setErreurSource(null);
    if (f && f.type !== "application/pdf") {
      setErreurSource("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (f && f.size > MAX_PDF_BYTES) {
      setErreurSource("Le PDF dépasse 5 Mo.");
      return;
    }
    setPdf(f);
    if (pdfInput.current) pdfInput.current.value = "";
  }

  function surDepot(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setGlisse(false);
    if (enCours) return;
    choisirPdf(e.dataTransfer.files?.[0] ?? null);
  }

  async function lancer(source: Source) {
    setEnCours(true);
    setEchec(false);
    setRemplacer(false);
    try {
      const body =
        "pdf" in source
          ? { mode: "pdf", pdf_base64: source.pdf }
          : { mode: "lien", url: source.url };
      const { data, error } = await supabase.functions.invoke("aide-redaction", { body });
      const p = data as Partial<PropositionIA> | null;
      if (
        error ||
        !p ||
        typeof p.titre !== "string" ||
        typeof p.texte !== "string" ||
        !p.titre ||
        !p.texte
      ) {
        setEchec(true);
        return;
      }
      setProposition({ titre: p.titre, texte: p.texte });
    } catch {
      setEchec(true);
    } finally {
      setEnCours(false);
    }
  }

  async function proposer() {
    if (enCours) return;
    setErreurSource(null);
    if (pdf) {
      try {
        await lancer({ pdf: await fichierEnBase64(pdf), nom: pdf.name });
      } catch (e) {
        setErreurSource((e as Error).message);
      }
      return;
    }
    const lien = url.trim();
    if (!lien) {
      setErreurSource("Ajoute un lien ou un PDF.");
      return;
    }
    await lancer({ url: lien });
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
    onProposition(proposition);
    setProposition(null);
    setRemplacer(false);
    setUrl("");
    setPdf(null);
  }

  const idTitre = `${idBase}-titre`;
  const idLien = `${idBase}-lien`;
  const idErreurSource = `${idBase}-erreur-source`;

  return (
    <div className="space-y-sm">
      <section aria-labelledby={idTitre} className="space-y-sm rounded-md bg-[#F5F4F1] p-md">
        <h3
          id={idTitre}
          className="font-label-md text-[13px] font-bold uppercase tracking-[0.04em] text-on-surface-variant"
        >
          Partir d'une source (facultatif)
        </h3>

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
          <button
            type="button"
            disabled={enCours}
            onClick={() => pdfInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setGlisse(true);
            }}
            onDragLeave={() => setGlisse(false)}
            onDrop={surDepot}
            className={cn(
              "flex w-full flex-col items-center gap-xs border border-dashed px-md py-md text-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
              glisse ? "border-primary bg-card" : "border-[#8A8A90] bg-transparent",
            )}
          >
            <Icone name="upload_file" className="text-[24px] text-on-surface-variant" />
            <span className="font-body-md text-on-surface">Ou glisse un PDF</span>
            <span className="text-[13px] text-on-surface-variant">
              ou clique pour le choisir (5 Mo max)
            </span>
          </button>
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
          disabled={enCours}
          onClick={proposer}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          <Icone name="auto_awesome" className="text-[18px]" />
          Proposer un titre et un texte avec l'IA
        </button>
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
            <span className="min-w-0">{MESSAGE_ECHEC}</span>
          </span>
          <button
            type="button"
            disabled={enCours}
            onClick={proposer}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Réessayer
          </button>
        </div>
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
