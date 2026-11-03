import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ChoixAuteur,
  useManagersPossibles,
  type AuteurPossible,
} from "@/components/news-author-picker";
import { NewsAiHelper, type PropositionAvecSource } from "@/components/news-ai-helper";
import { NewsImage } from "@/components/news-media";
import { useDepotFichier } from "@/components/use-depot-fichier";
import { CLASSE_LIEN_ACTION, CLASSE_LIEN_SUPPRIMER, TEXTE_SOULIGNE } from "@/components/chips";
import { buttonVariants } from "@/components/ui/button";
import { publishDraftNews, saveDraftNews, updateNews, type News } from "@/lib/dashboard";
import {
  MAX_NEWS_LINKS,
  NEWS_IMAGE_TYPES,
  nomDuSite,
  emptyMedia,
  imageError,
  linkErrors,
  mediaFromNews,
  toNewsLinks,
  type MediaDraft,
} from "@/lib/news-media";
import { initialesDe } from "@/lib/noms";
import { cn } from "@/lib/utils";

const TITRE_MAX = 100;
const CONTENU_MAX = 3000;
const LIBELLE_TITRE = "Titre de l'actualité";
const CLASSE_CHAMP =
  "w-full min-h-11 rounded-[6px] border bg-card px-sm py-xs font-body-md text-on-surface placeholder:text-[#68686D] focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";
const CLASSE_LABEL =
  "block text-[13px] font-bold uppercase tracking-[0.04em] text-on-surface-variant";
/** Aperçu de l'image d'illustration : vignette fixe de 160 × 120 px, coins de 6 px. */
const VIGNETTE_IMAGE =
  "h-[120px] w-[160px] max-w-full max-h-none rounded-[6px] border border-outline-variant object-cover";
const CLASSE_ERREUR = "flex items-start gap-xs text-[13px] text-[#A81E25]";

function Icone({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

type Confirmation = null | "fermer";

/** Empreinte du contenu saisi : sert à savoir si une fermeture perdrait des modifications. */
function empreinte(titre: string, corps: string, media: MediaDraft, auteurEmail: string) {
  return JSON.stringify([
    titre,
    corps,
    media.links,
    media.file?.name ?? null,
    media.removeExisting,
    auteurEmail,
  ]);
}

/**
 * Fenêtre « Nouvelle actualité » et « Modifier l'actualité » : en-tête fixe, corps qui défile,
 * pied fixe. Focus initial sur le premier champ, piège du focus, Échap (confirmation si des champs sont
 * remplis), retour du focus au bouton d'origine (gérés par Radix Dialog).
 */
export function NewsEditor({
  news,
  isAdmin,
  email,
  auteur,
  roleEquipe,
  onFermer,
}: {
  /** Actualité existante (brouillon ou publiée), ou null pour une nouvelle actualité. */
  news: News | null;
  isAdmin: boolean;
  /** Adresse de la personne connectée (minuscules). */
  email: string;
  /** Nom de la personne connectée, enregistré comme auteur quand elle publie pour elle-même. */
  auteur: string;
  /** « Manager Product et Marketing » : affiché hors admin. */
  roleEquipe: string;
  onFermer: () => void;
}) {
  const qc = useQueryClient();
  const idBase = useId();
  const estPubliee = news?.status === "publiée";
  const titreFenetre = !news
    ? "Nouvelle actualité"
    : estPubliee
      ? "Modifier l'actualité"
      : "Modifier le brouillon";

  const [titre, setTitre] = useState(news?.title ?? "");
  const [corps, setCorps] = useState(news?.body ?? "");
  const [media, setMedia] = useState<MediaDraft>(() => (news ? mediaFromNews(news) : emptyMedia()));
  const emailDepart = (news?.author_email ?? "").toLowerCase() || email;
  const [auteurEmail, setAuteurEmail] = useState(emailDepart);
  const [depart] = useState(() =>
    empreinte(
      news?.title ?? "",
      news?.body ?? "",
      news ? mediaFromNews(news) : emptyMedia(),
      emailDepart,
    ),
  );
  const [montrerErreurs, setMontrerErreurs] = useState(false);
  const [tentative, setTentative] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [comboOuvert, setComboOuvert] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bandeau = useRef<HTMLDivElement>(null);

  const managers = useManagersPossibles(isAdmin);
  const options: AuteurPossible[] = useMemo(
    () => [
      { email, nom: auteur, libelle: `Moi (${auteur})`, initiales: initialesDe(auteur) },
      ...(managers.data ?? []).filter((m) => m.email !== email),
    ],
    [email, auteur, managers.data],
  );
  const choisi = options.find((o) => o.email === auteurEmail);
  // Nom enregistré : celui de la personne choisie, sinon celui de l'actualité existante
  const nomChoisi = choisi?.nom ?? news?.author ?? auteur;
  const delegation = isAdmin && auteurEmail !== email;

  const erreurTitre = !titre.trim();
  const erreurContenu = !corps.trim();
  const erreursLiens = linkErrors(media.links);
  const nbErreurs =
    (erreurTitre ? 1 : 0) + (erreurContenu ? 1 : 0) + Object.keys(erreursLiens).length;
  const montrerTitre = montrerErreurs && erreurTitre;
  const montrerContenu = montrerErreurs && erreurContenu;
  const montrerLiens = montrerErreurs ? erreursLiens : {};

  // Après une tentative invalide, le focus va au bandeau d'erreur (lu par les lecteurs d'écran)
  useEffect(() => {
    if (tentative > 0) bandeau.current?.focus();
  }, [tentative]);

  const modifie = empreinte(titre, corps, media, auteurEmail) !== depart;

  const sauver = useMutation({
    mutationFn: async (statut: "brouillon" | "publiée") => {
      const base = {
        title: titre.trim(),
        body: corps,
        author: nomChoisi,
        author_email: auteurEmail,
        links: toNewsLinks(media.links),
      };
      if (news && estPubliee) {
        await updateNews(news.id, { ...base, status: "publiée" }, media);
        return "modifiee" as const;
      }
      const id = await saveDraftNews({ ...base, id: news?.id, media });
      if (statut === "brouillon") return "brouillon" as const;
      await publishDraftNews(id);
      return "publiee" as const;
    },
    onSuccess: (resultat) => {
      toast.success(
        resultat === "modifiee"
          ? "Actualité modifiée"
          : resultat === "brouillon"
            ? "Brouillon enregistré"
            : "Actualité publiée",
      );
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
      onFermer();
    },
    onError: (e) => {
      setConfirmation(null);
      toast.error((e as Error).message);
    },
  });

  function soumettre(statut: "brouillon" | "publiée") {
    if (sauver.isPending) return;
    setMontrerErreurs(true);
    setTentative((t) => t + 1);
    if (nbErreurs > 0) return;
    // « Publier » publie directement ; la confirmation de la liste des brouillons reste dans actualites-cabinet
    sauver.mutate(statut);
  }

  /**
   * Proposition de l'IA appliquée au formulaire, source citée : un lien est ajouté aux liens (sans doublon,
   * dans la limite de 3), un PDF est cité à la fin du contenu. Renvoie une ligne d'information si le lien n'a
   * pas pu être ajouté.
   */
  function appliquerProposition(p: PropositionAvecSource): string | void {
    setTitre(p.titre.slice(0, TITRE_MAX));
    if (p.source.type === "pdf") {
      const ligne = `Source : ${p.source.nom}`;
      const place = CONTENU_MAX - ligne.length - 2;
      setCorps(`${p.texte.slice(0, place).trimEnd()}\n\n${ligne}`);
      return;
    }
    setCorps(p.texte.slice(0, CONTENU_MAX));
    const url = p.source.url;
    if (media.links.some((l) => l.url.trim() === url)) return;
    if (media.links.length >= MAX_NEWS_LINKS) {
      return `Les ${MAX_NEWS_LINKS} liens sont déjà ajoutés : la source n'a pas été ajoutée. Retire un lien pour l'ajouter.`;
    }
    setMedia({ ...media, links: [...media.links, { url, label: `Source : ${nomDuSite(url)}` }] });
  }

  function demanderFermeture() {
    if (sauver.isPending) return;
    if (confirmation === "fermer") {
      setConfirmation(null);
      return;
    }
    if (modifie) setConfirmation("fermer");
    else onFermer();
  }

  const libelleEnregistrer = estPubliee
    ? "Enregistrer les modifications"
    : "Enregistrer en brouillon";
  const note = delegation
    ? `L'actualité affichera « ${nomChoisi}, via ${auteur} (admin) ».`
    : isAdmin
      ? `L'actualité sera publiée sous ton nom.`
      : "";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && demanderFermeture()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            // Échap ferme d'abord la liste des auteurs, sinon la fenêtre (avec confirmation)
            if (comboOuvert) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            demanderFermeture();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          // Clic sur le voile (zone hors de la fenêtre) : même chemin qu'Échap, avec confirmation si besoin
          onClick={(e) => {
            if (e.target === e.currentTarget) demanderFermeture();
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            formRef.current
              ?.querySelector<HTMLElement>('[role="combobox"], input[name="titre-actu"]')
              ?.focus();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-sm md:p-lg focus:outline-none"
        >
          <div className="flex max-h-full w-full max-w-[44rem] flex-col border border-outline bg-surface-container-lowest shadow-lg">
            <header className="flex items-center justify-between gap-sm border-b border-outline-variant px-md py-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-sm">
                <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary">
                  {titreFenetre}
                </DialogPrimitive.Title>
                {isAdmin && (
                  <span className="rounded-[4px] bg-[#EDEBE6] px-xs py-[2px] text-[12px] font-bold tracking-[0.06em] text-[#28282D]">
                    ADMIN
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={demanderFermeture}
                className="inline-flex min-h-11 shrink-0 items-center gap-xs text-sm font-semibold text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span aria-hidden="true">✕</span>
                <span className={TEXTE_SOULIGNE}>Fermer</span>
              </button>
            </header>
            <DialogPrimitive.Description className="sr-only">
              Les champs marqués d'une étoile sont obligatoires.
            </DialogPrimitive.Description>

            <form
              ref={formRef}
              noValidate
              onSubmit={(e) => e.preventDefault()}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-md overflow-y-auto p-md">
                {nbErreurs > 0 && montrerErreurs && (
                  <div
                    ref={bandeau}
                    role="alert"
                    tabIndex={-1}
                    className="flex items-center gap-xs bg-[#F5D5D4] p-sm text-body-sm font-semibold text-[#28282D] focus:outline-none"
                  >
                    <Icone name="error" className="text-[18px]" />
                    {`Il manque ${nbErreurs} information${nbErreurs > 1 ? "s" : ""}.`}
                  </div>
                )}

                {isAdmin ? (
                  <ChoixAuteur
                    options={options}
                    valeur={auteurEmail}
                    onChoisir={setAuteurEmail}
                    note={note}
                    disabled={sauver.isPending}
                    onOuvertChange={setComboOuvert}
                  />
                ) : (
                  <p className="flex items-center gap-xs text-body-sm text-on-surface">
                    <Icone name="person" className="text-[18px] text-on-surface-variant" />
                    {`Par ${auteur} · ${roleEquipe}`}
                  </p>
                )}

                <CompteurChamp
                  idChamp={`${idBase}-titre`}
                  libelle={LIBELLE_TITRE}
                  compteur={`${titre.length} / ${TITRE_MAX}`}
                  erreur={montrerTitre ? "Donne un titre à ton actualité." : undefined}
                >
                  <input
                    id={`${idBase}-titre`}
                    name="titre-actu"
                    type="text"
                    maxLength={TITRE_MAX}
                    value={titre}
                    placeholder="Un titre court et clair"
                    disabled={sauver.isPending}
                    aria-required="true"
                    aria-invalid={montrerTitre || undefined}
                    aria-describedby={montrerTitre ? `${idBase}-titre-erreur` : undefined}
                    onChange={(e) => setTitre(e.target.value)}
                    className={cn(
                      CLASSE_CHAMP,
                      montrerTitre ? "border-[#A81E25]" : "border-[#8A8A90]",
                    )}
                  />
                </CompteurChamp>

                <CompteurChamp
                  idChamp={`${idBase}-contenu`}
                  libelle="Contenu"
                  compteur={`${corps.length} / ${CONTENU_MAX}`}
                  erreur={
                    montrerContenu
                      ? "Écris le contenu ou utilise une proposition de l'IA."
                      : undefined
                  }
                >
                  <textarea
                    id={`${idBase}-contenu`}
                    name="contenu-actu"
                    rows={6}
                    maxLength={CONTENU_MAX}
                    value={corps}
                    placeholder="Écris l'essentiel en quelques phrases, ou pars d'une source et laisse l'IA te proposer un premier jet."
                    disabled={sauver.isPending}
                    aria-required="true"
                    aria-invalid={montrerContenu || undefined}
                    aria-describedby={montrerContenu ? `${idBase}-contenu-erreur` : undefined}
                    onChange={(e) => setCorps(e.target.value)}
                    className={cn(
                      CLASSE_CHAMP,
                      "resize-y rounded-md p-sm",
                      montrerContenu ? "border-[#A81E25]" : "border-[#8A8A90]",
                    )}
                  />
                </CompteurChamp>

                <NewsAiHelper
                  titre={titre}
                  texte={corps}
                  onProposition={(p) => appliquerProposition(p)}
                />

                <ChampImage
                  idChamp={`${idBase}-image`}
                  value={media}
                  onChange={setMedia}
                  disabled={sauver.isPending}
                  titre={titre}
                />

                <ChampLiens
                  idChamp={`${idBase}-liens`}
                  value={media.links}
                  onChange={(links) => setMedia({ ...media, links })}
                  disabled={sauver.isPending}
                  erreurs={montrerLiens}
                />
              </div>

              {confirmation && (
                <div
                  role="group"
                  aria-label="Confirmer la fermeture"
                  className="flex flex-wrap items-center justify-between gap-sm border-t border-outline-variant bg-card px-md py-sm"
                >
                  <p className="min-w-0 text-body-sm font-semibold text-on-surface wrap-anywhere">
                    Abandonner ta saisie ? Les champs remplis seront perdus.
                  </p>
                  <div className="flex flex-wrap gap-xs">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setConfirmation(null)}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Continuer la saisie
                    </button>
                    <button
                      type="button"
                      onClick={onFermer}
                      className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                    >
                      Abandonner
                    </button>
                  </div>
                </div>
              )}

              <footer className="space-y-sm border-t border-outline-variant bg-[#F5F4F1] px-md py-sm">
                <p className="flex min-w-0 items-center gap-xs text-[13px] text-on-surface-variant">
                  <Icone
                    name={delegation ? "shield" : "visibility"}
                    className="shrink-0 text-[18px]"
                  />
                  <span>
                    {delegation
                      ? "Publication administrative déléguée."
                      : estPubliee
                        ? "Visible par tout Bigger Boat."
                        : "Visible par tout Bigger Boat une fois publiée."}
                  </span>
                </p>
                {/* Une ligne : « Annuler » à gauche ; sous 480 px, les boutons s'empilent, « Publier » en premier */}
                <div className="flex flex-col-reverse gap-xs min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                  <button
                    type="button"
                    disabled={sauver.isPending}
                    onClick={demanderFermeture}
                    className={buttonVariants({ variant: "secondary" }) + " w-full min-[480px]:w-auto"}
                  >
                    Annuler
                  </button>
                  <div className="flex flex-col-reverse gap-xs min-[480px]:flex-row min-[480px]:items-center">
                    {!estPubliee && (
                      <button
                        type="button"
                        disabled={sauver.isPending}
                        onClick={() => soumettre("brouillon")}
                        className={buttonVariants({ variant: "secondary" }) + " w-full min-[480px]:w-auto"}
                      >
                        {libelleEnregistrer}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={sauver.isPending}
                      onClick={() => soumettre("publiée")}
                      className={buttonVariants({ variant: "default" }) + " w-full min-[480px]:w-auto"}
                    >
                      {estPubliee ? "Enregistrer les modifications" : "Publier"}
                    </button>
                  </div>
                </div>
              </footer>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Libellé en capitales, compteur à droite, champ et message d'erreur relié par aria-describedby. */
function CompteurChamp({
  idChamp,
  libelle,
  compteur,
  erreur,
  children,
}: {
  idChamp: string;
  libelle: string;
  compteur: string;
  erreur?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-xs">
      <div className="flex items-baseline justify-between gap-sm">
        <label htmlFor={idChamp} className={CLASSE_LABEL}>
          {libelle} <span aria-hidden="true">*</span>
        </label>
        <span className="shrink-0 text-[13px] tabular-nums text-on-surface-variant">
          {compteur}
        </span>
      </div>
      {children}
      {erreur && (
        <p id={`${idChamp}-erreur`} className={CLASSE_ERREUR}>
          <Icone name="error" className="text-[16px] leading-none" />
          {erreur}
        </p>
      )}
    </div>
  );
}

/** Image d'illustration : zone en pointillés (glisser-déposer et clic), aperçu, remplacer ou retirer. */
function ChampImage({
  idChamp,
  value,
  onChange,
  disabled,
  titre,
}: {
  idChamp: string;
  value: MediaDraft;
  onChange: (v: MediaDraft) => void;
  disabled?: boolean;
  titre: string;
}) {
  const entree = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const apercu = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu);
    },
    [apercu],
  );
  const existante =
    !value.file && value.existingPath && !value.removeExisting ? value.existingPath : null;

  function prendre(f: File | null | undefined) {
    if (!f) return;
    const err = imageError(f);
    setErreur(err);
    if (!err) onChange({ ...value, file: f });
  }

  const depot = useDepotFichier((f) => prendre(f), disabled);

  const idFormat = `${idChamp}-format`;

  return (
    <div className="space-y-xs">
      <span id={`${idChamp}-libelle`} className={cn(CLASSE_LABEL, "block")}>
        Image d'illustration (facultatif)
      </span>
      {apercu || existante ? (
        <div className="space-y-xs">
          {apercu ? (
            <img src={apercu} alt="Aperçu de l'image" className={VIGNETTE_IMAGE} />
          ) : (
            <NewsImage path={existante!} alt="Aperçu de l'image" className={VIGNETTE_IMAGE} />
          )}
          <div className="flex flex-wrap items-center gap-md">
            <button
              type="button"
              disabled={disabled}
              onClick={() => entree.current?.click()}
              className={CLASSE_LIEN_ACTION}
            >
              <span className={TEXTE_SOULIGNE}>Remplacer l'image</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({ ...value, file: null, removeExisting: !!value.existingPath })
              }
              className={CLASSE_LIEN_SUPPRIMER}
            >
              <span className={TEXTE_SOULIGNE}>Retirer l'image</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          {...depot.zone}
          data-testid="zone-depot-image"
          className={cn(
            "rounded-md border border-dashed transition-colors",
            depot.glisse ? "border-primary border-2 bg-card" : "border-[#8A8A90] bg-transparent",
          )}
        >
          <button
            type="button"
            disabled={disabled}
            aria-labelledby={`${idChamp}-libelle`}
            aria-describedby={idFormat}
            onClick={() => entree.current?.click()}
            className="flex w-full flex-col items-center gap-xs px-md py-md text-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <Icone name="image" className="text-[24px] text-on-surface-variant" />
            <span className="font-body-md text-on-surface">
              {depot.glisse
                ? "Dépose l'image ici"
                : "Glisse une image ici, ou clique pour la choisir"}
            </span>
            <span id={idFormat} className="text-[13px] text-on-surface-variant">
              JPG, PNG ou WebP, 5 Mo max.
            </span>
          </button>
        </div>
      )}
      {erreur && (
        <p role="alert" className={CLASSE_ERREUR}>
          <Icone name="error" className="text-[16px] leading-none" />
          {erreur}
        </p>
      )}
      <input
        ref={entree}
        type="file"
        accept={NEWS_IMAGE_TYPES.join(",")}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        data-testid="news-image-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          prendre(f);
        }}
      />
    </div>
  );
}

/** Liens (3 maximum) : adresse obligatoire, libellé facultatif, erreurs reliées aux champs. */
function ChampLiens({
  idChamp,
  value,
  onChange,
  disabled,
  erreurs,
}: {
  idChamp: string;
  value: MediaDraft["links"];
  onChange: (v: MediaDraft["links"]) => void;
  disabled?: boolean;
  erreurs: Record<number, string>;
}) {
  const plein = value.length >= MAX_NEWS_LINKS;
  return (
    <div className="space-y-xs">
      <span className={cn(CLASSE_LABEL, "block")}>Liens (facultatif)</span>
      {value.map((l, i) => {
        const idErreur = `${idChamp}-${i}-erreur`;
        return (
          <div key={i} className="space-y-xs">
            <div className="flex min-w-0 flex-col gap-xs sm:flex-row">
              <input
                name="lien-adresse"
                aria-label={`Adresse du lien ${i + 1}`}
                placeholder="https://…"
                maxLength={2000}
                value={l.url}
                disabled={disabled}
                aria-invalid={!!erreurs[i] || undefined}
                aria-describedby={erreurs[i] ? idErreur : undefined}
                onChange={(e) =>
                  onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
                className={cn(
                  CLASSE_CHAMP,
                  "min-w-0 flex-[2] py-xs",
                  erreurs[i] ? "border-[#A81E25]" : "border-[#8A8A90]",
                )}
              />
              <div className="flex min-w-0 flex-1 gap-xs">
                <input
                  name="lien-libelle"
                  aria-label={`Libellé du lien ${i + 1} (facultatif)`}
                  placeholder="Libellé (facultatif)"
                  maxLength={80}
                  value={l.label}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                  className={cn(CLASSE_CHAMP, "min-w-0 flex-1 border-[#8A8A90] py-xs")}
                />
                <button
                  type="button"
                  aria-label={`Retirer le lien ${i + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-on-surface-variant hover:text-[#A81E25] focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Icone name="close" />
                </button>
              </div>
            </div>
            {erreurs[i] && (
              <p id={idErreur} className={CLASSE_ERREUR}>
                <Icone name="error" className="text-[16px] leading-none" />
                {erreurs[i]}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-sm">
        <button
          type="button"
          disabled={disabled || plein}
          onClick={() => onChange([...value, { url: "", label: "" }])}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Icone name="add" className="text-[18px]" />
          Ajouter un lien
        </button>
        {plein && <span className="text-[13px] text-on-surface-variant">3 liens maximum.</span>}
      </div>
    </div>
  );
}
