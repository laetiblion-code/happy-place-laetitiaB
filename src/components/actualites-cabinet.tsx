import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { FormActions, Modal } from "@/components/manage/crud-ui";
import { NewsAiHelper } from "@/components/news-ai-helper";
import { NewsLinks, NewsMediaEditor, NewsVignette } from "@/components/news-media";
import { NewsReader } from "@/components/news-reader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteDraftNews,
  deleteNews,
  fetchNews,
  formatDateCourte,
  publishDraftNews,
  saveDraftNews,
  timeAgo,
  updateNews,
  type News,
} from "@/lib/dashboard";
import {
  emptyMedia,
  linkErrors,
  mediaFromNews,
  toNewsLinks,
  type MediaDraft,
} from "@/lib/news-media";
import { nomAffiche, useNomsAffiches } from "@/lib/noms";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Lien d'action : le soulignement porte sur le texte seulement (les icônes ne sont pas soulignées). */
const LIEN_ACTION =
  "inline-flex min-h-11 items-center gap-xs font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type Brouillon = { id: string | null; publiee: boolean };

/**
 * « Actualités du cabinet » : liste des dernières publications, brouillons (manager et admin) et rédaction
 * dans une fenêtre modale. Les droits suivent les règles de la base : un manager ne modifie que ses brouillons.
 */
export function ActualitesCabinet({
  role,
  email,
  auteur,
  ouvertureDemandee = 0,
}: {
  role: "admin" | "manager" | "collaborateur";
  /** Adresse de la personne connectée (en minuscules). */
  email: string;
  /** Nom enregistré comme auteur des actualités. */
  auteur: string;
  /** Compteur incrémenté depuis l'en-tête pour ouvrir la rédaction (« Nouvelle actualité »). */
  ouvertureDemandee?: number;
}) {
  const qc = useQueryClient();
  const [demander, dialogueConfirm] = useConfirm();
  const isAdmin = role === "admin";
  const canWrite = role === "admin" || role === "manager";

  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const published = (news.data ?? []).filter((n) => n.status === "publiée");
  const drafts = (news.data ?? []).filter(
    (n) => n.status === "brouillon" && (isAdmin || (n.author_email ?? "").toLowerCase() === email),
  );
  const noms = useNomsAffiches((news.data ?? []).map((n) => n.author ?? "")).data;

  const [lue, setLue] = useState<News | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Vrai tant que le titre et le texte viennent d'une proposition de l'IA non enregistrée
  const [propositionIA, setPropositionIA] = useState(false);
  const [media, setMedia] = useState<MediaDraft>(emptyMedia);
  const [showLinkErrs, setShowLinkErrs] = useState(false);
  const linkErrs = showLinkErrs ? linkErrors(media.links) : {};

  function ouvrir(n: News | null) {
    setTitle(n?.title ?? "");
    setBody(n?.body ?? "");
    setMedia(n ? mediaFromNews(n) : emptyMedia());
    setPropositionIA(false);
    setShowLinkErrs(false);
    setBrouillon(n ? { id: n.id, publiee: n.status === "publiée" } : { id: null, publiee: false });
  }

  function fermer() {
    setBrouillon(null);
  }

  // Ouverture demandée depuis l'en-tête : seulement quand le compteur change, pas au premier affichage
  const ouvertureVue = useRef(ouvertureDemandee);
  useEffect(() => {
    if (ouvertureDemandee !== ouvertureVue.current) {
      ouvertureVue.current = ouvertureDemandee;
      if (canWrite) ouvrir(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvertureDemandee]);

  const invaliderActus = () => {
    qc.invalidateQueries({ queryKey: ["news"] });
    qc.invalidateQueries({ queryKey: ["home-counts"] });
  };
  const onError = (e: unknown) => toast.error((e as Error).message);

  const enregistrer = useMutation({
    mutationFn: (v: {
      id: string | null;
      publiee: boolean;
      title: string;
      body: string;
      links: ReturnType<typeof toNewsLinks>;
      media: MediaDraft;
    }) =>
      v.publiee && v.id
        ? updateNews(
            v.id,
            { title: v.title, body: v.body, author: auteur, status: "publiée", links: v.links },
            v.media,
          )
        : saveDraftNews({
            id: v.id ?? undefined,
            title: v.title,
            body: v.body,
            author: auteur,
            author_email: email,
            links: v.links,
            media: v.media,
          }),
    onSuccess: (_d, v) => {
      toast.success(v.publiee ? "Actualité modifiée" : "Brouillon enregistré");
      fermer();
      invaliderActus();
    },
    onError,
  });

  const publier = useMutation({
    mutationFn: publishDraftNews,
    onSuccess: () => {
      toast.success("Actualité publiée");
      invaliderActus();
    },
    onError,
  });

  const supprimer = useMutation({
    mutationFn: (n: News) =>
      n.status === "publiée" ? deleteNews(n.id, n.image_path) : deleteDraftNews(n.id, n.image_path),
    onSuccess: (_d, n) => {
      toast.success(n.status === "publiée" ? "Actualité supprimée" : "Brouillon supprimé");
      invaliderActus();
    },
    onError,
  });

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!brouillon) return;
    if (!title.trim()) return;
    setShowLinkErrs(true);
    if (Object.keys(linkErrors(media.links)).length) {
      toast.error("Corrige les liens invalides avant d'enregistrer.");
      return;
    }
    enregistrer.mutate({
      id: brouillon.id,
      publiee: brouillon.publiee,
      title: title.trim(),
      body,
      links: toNewsLinks(media.links),
      media,
    });
  }

  async function confirmerSuppression(n: News) {
    const publiee = n.status === "publiée";
    if (
      await demander({
        titre: publiee ? "Supprimer l'actualité" : "Supprimer le brouillon",
        message: `${publiee ? "Supprimer l'actualité" : "Supprimer le brouillon"} « ${n.title} » ?`,
        libelleConfirmer: "Supprimer",
        destructive: true,
      })
    )
      supprimer.mutate(n);
  }

  return (
    <section
      aria-labelledby="titre-actus"
      className="flex min-w-0 flex-col gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant pb-sm">
        <h2 id="titre-actus" className="font-headline-sm text-headline-sm text-primary">
          Actualités du cabinet
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => ouvrir(null)}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Icon name="add" /> Ajouter une actu
          </button>
        )}
      </div>

      {canWrite && (
        <div className="space-y-sm rounded-md bg-surface-container p-sm">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <h3 className="font-label-md text-label-md uppercase text-on-surface-variant">
              {isAdmin ? "Tous les brouillons" : "Mes brouillons"}
            </h3>
            <span className="rounded-full bg-tertiary-fixed px-sm py-[2px] font-label-sm text-sm tabular-nums text-on-tertiary-fixed">
              {`${drafts.length} en cours`}
            </span>
          </div>
          {drafts.length === 0 ? (
            <p className="font-body-sm italic text-on-surface-variant">Aucun brouillon en cours.</p>
          ) : (
            // Conteneur : toutes les cartes changent de disposition ensemble, selon la largeur de la liste
            <ul className="@container space-y-xs">
              {drafts.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-sm rounded-md border border-outline-variant bg-card p-sm @[36rem]:flex-row @[36rem]:items-center @[36rem]:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-body-md font-bold text-primary wrap-anywhere">{n.title}</p>
                    <p className="font-label-sm text-sm text-on-surface-variant">
                      {`Rédigé par ${nomAffiche(n.author ?? "", noms)} · Créé ${timeAgo(n.created_at)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-xs @[36rem]:shrink-0 @[36rem]:justify-end">
                    <button
                      type="button"
                      disabled={supprimer.isPending}
                      onClick={() => confirmerSuppression(n)}
                      aria-label={`Supprimer le brouillon « ${n.title} »`}
                      className="inline-flex min-h-11 items-center gap-xs px-sm font-label-sm text-sm text-error"
                    >
                      <Icon name="delete" />
                      <span className="underline underline-offset-2">Supprimer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => ouvrir(n)}
                      aria-label={`Modifier le brouillon « ${n.title} »`}
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "sm" }),
                        "text-sm",
                      )}
                    >
                      <Icon name="edit" /> Modifier
                    </button>
                    <button
                      type="button"
                      disabled={publier.isPending}
                      onClick={async () => {
                        if (
                          await demander({
                            titre: "Publier l'actualité",
                            message: `Publier l'actualité « ${n.title} » ? Elle sera visible par tous.`,
                            libelleConfirmer: "Publier",
                          })
                        )
                          publier.mutate(n.id);
                      }}
                      aria-label={`Publier « ${n.title} »`}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }), "text-sm")}
                    >
                      Publier
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-sm">
        <h3 className="font-label-md text-label-md uppercase text-on-surface-variant">
          Publiées récemment
        </h3>
        {news.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
        {news.isError && (
          <p className="text-body-sm text-error">Les actualités sont indisponibles.</p>
        )}
        {news.isSuccess && published.length === 0 && (
          <p className="font-body-sm italic text-on-surface-variant">
            Aucune actualité publiée pour le moment.
          </p>
        )}
        <ul className="space-y-sm">
          {published.slice(0, 4).map((n) => (
            <li
              key={n.id}
              className="flex min-w-0 gap-sm border-t border-outline-variant pt-sm first:border-t-0 first:pt-0"
            >
              <time
                dateTime={n.created_at}
                className="w-14 shrink-0 font-label-sm text-sm text-on-surface-variant"
              >
                {formatDateCourte(n.created_at)}
              </time>
              {n.image_path && <NewsVignette path={n.image_path} alt={n.title} />}
              <div className="min-w-0 flex-1 space-y-xs">
                <p className="font-body-md font-bold text-primary wrap-anywhere">{n.title}</p>
                <p className="font-label-sm text-sm text-on-surface-variant">
                  {`Par ${nomAffiche(n.author ?? "", noms)}`}
                </p>
                <NewsLinks links={n.links} />
                <div className="flex flex-wrap items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => setLue(n)}
                    aria-haspopup="dialog"
                    aria-label={`Lire l'actualité « ${n.title} »`}
                    className={LIEN_ACTION}
                  >
                    <span className="underline underline-offset-2">Lire</span>
                    <Icon name="arrow_forward" className="text-base" />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => ouvrir(n)}
                        aria-label={`Modifier l'actualité « ${n.title} »`}
                        className={LIEN_ACTION}
                      >
                        <Icon name="edit" className="text-base" />
                        <span className="underline underline-offset-2">Modifier</span>
                      </button>
                      <button
                        type="button"
                        disabled={supprimer.isPending}
                        onClick={() => confirmerSuppression(n)}
                        aria-label={`Supprimer l'actualité « ${n.title} »`}
                        className="inline-flex min-h-11 items-center gap-xs font-label-sm text-sm text-error focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Icon name="delete" className="text-base" />
                        <span className="underline underline-offset-2">Supprimer</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {published.length > 0 && (
          <Link to="/actualites" className={LIEN_ACTION}>
            <span className="underline underline-offset-2">Voir toutes les actualités</span>
          </Link>
        )}
      </div>

      {brouillon && (
        <Modal
          title={
            brouillon.id
              ? brouillon.publiee
                ? "Modifier l'actualité"
                : "Modifier le brouillon"
              : "Nouvelle actualité"
          }
          onClose={fermer}
        >
          <form data-corps-modale onSubmit={envoyer} noValidate className="space-y-md">
            {propositionIA && (
              <p className="inline-flex items-center gap-xs bg-[#F0D0BC] px-sm py-xs font-label-sm text-sm text-on-surface">
                <Icon name="auto_awesome" className="text-sm" />
                Proposition de l'IA, à relire
              </p>
            )}
            <div className="space-y-xs">
              <label
                htmlFor="actu-titre"
                className="block font-label-md text-label-md text-on-surface-variant"
              >
                TITRE
              </label>
              <input
                id="actu-titre"
                autoFocus
                type="text"
                value={title}
                placeholder="Saisis un titre…"
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border-b border-[#8A8A90] bg-transparent px-0 py-xs font-headline-sm text-headline-sm focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>
            <div className="space-y-xs">
              <label
                htmlFor="actu-contenu"
                className="block font-label-md text-label-md text-on-surface-variant"
              >
                CONTENU
              </label>
              <textarea
                id="actu-contenu"
                rows={5}
                value={body}
                placeholder="Rédige l'actualité…"
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-md border border-[#8A8A90] bg-card p-sm font-body-md focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>
            <NewsMediaEditor
              value={media}
              onChange={setMedia}
              linkErrs={linkErrs}
              disabled={enregistrer.isPending}
              title={title}
            />
            <NewsAiHelper
              titre={title}
              texte={body}
              onProposition={(p) => {
                setTitle(p.titre);
                setBody(p.texte);
                setPropositionIA(true);
              }}
            />
            <FormActions
              pending={enregistrer.isPending}
              submitLabel={
                brouillon.publiee ? "Enregistrer les modifications" : "Enregistrer le brouillon"
              }
              onCancel={fermer}
            />
          </form>
        </Modal>
      )}

      <NewsReader news={lue} onClose={() => setLue(null)} />
      {dialogueConfirm}
    </section>
  );
}
