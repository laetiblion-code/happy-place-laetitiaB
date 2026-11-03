import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { AuteurActualite } from "@/components/news-author";
import { NewsEditor } from "@/components/news-editor";
import { NewsLinks, NewsVignette } from "@/components/news-media";
import { NewsReader } from "@/components/news-reader";
import { buttonVariants } from "@/components/ui/button";
import {
  CLASSE_BOUTON_CARTE,
  CLASSE_LIEN_ACTION,
  CLASSE_LIEN_SUPPRIMER,
  EtiquetteSoi,
  LienBasBloc,
  TEXTE_SOULIGNE,
} from "@/components/chips";
import { ilYAShort } from "@/lib/duree-libelles";
import { cn } from "@/lib/utils";
import {
  deleteDraftNews,
  deleteNews,
  fetchNews,
  formatDateCourte,
  publishDraftNews,
  type News,
} from "@/lib/dashboard";
import { nomAffiche, useNomsAffiches } from "@/lib/noms";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Auteur d'un brouillon : « Rédigé par Kesha » ou, si délégué, « Rédigé par Olivia pour Kesha ». */
function libelleBrouillon(n: News, noms: Map<string, string> | undefined): string {
  const auteur = nomAffiche(n.author ?? "", noms);
  const qui = n.delegated_by_email
    ? `Rédigé par ${nomAffiche(n.delegated_by_email, noms)} pour ${auteur}`
    : `Rédigé par ${auteur}`;
  return `${qui} · Dernière modif ${ilYAShort(n.updated_at ?? n.created_at)}`;
}

const ROLE_LIBELLE = {
  admin: "Admin",
  manager: "Manager",
  collaborateur: "Collaborateur",
} as const;

/**
 * « Actualités du cabinet » : liste des dernières publications, brouillons (manager et admin) et rédaction
 * dans une fenêtre modale. Les droits suivent les règles de la base : un manager ne modifie que ses brouillons.
 */
export function ActualitesCabinet({
  role,
  email,
  auteur,
  equipe = "",
  ouvertureDemandee = 0,
}: {
  role: "admin" | "manager" | "collaborateur";
  /** Adresse de la personne connectée (en minuscules). */
  email: string;
  /** Nom enregistré comme auteur des actualités. */
  auteur: string;
  /** Équipe de la personne connectée (affichée à côté de son rôle sur ses propres actualités). */
  equipe?: string;
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
  const noms = useNomsAffiches(
    (news.data ?? []).flatMap((n) => [n.author ?? "", n.delegated_by_email ?? ""]),
  ).data;

  const [lue, setLue] = useState<News | null>(null);
  const [apercu, setApercu] = useState<News | null>(null);
  // Fenêtre de rédaction ouverte : news null = nouvelle actualité
  const [editeur, setEditeur] = useState<{ news: News | null } | null>(null);

  function ouvrir(n: News | null) {
    setEditeur({ news: n });
  }

  function fermer() {
    setEditeur(null);
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
            <ul className="space-y-xs">
              {drafts.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-sm rounded-md border border-outline-variant bg-card p-sm"
                >
                  {/* Vignette carrée (si image) à gauche, comme pour les actualités publiées */}
                  <div className="flex min-w-0 gap-sm">
                    {n.image_path && <NewsVignette path={n.image_path} alt={n.title} />}
                    <div className="min-w-0 flex-1 space-y-xs">
                      <p className="font-body-md font-bold text-primary wrap-anywhere">{n.title}</p>
                      <p className="font-label-sm text-sm text-on-surface-variant">
                        {libelleBrouillon(n, noms)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-sm">
                    <div className="flex flex-wrap items-center gap-md">
                      <button
                        type="button"
                        disabled={supprimer.isPending}
                        onClick={() => confirmerSuppression(n)}
                        aria-label={`Supprimer le brouillon « ${n.title} »`}
                        className={CLASSE_LIEN_SUPPRIMER}
                      >
                        <Icon name="delete" className="text-base" />
                        <span className={TEXTE_SOULIGNE}>Supprimer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => ouvrir(n)}
                        aria-label={`Modifier le brouillon « ${n.title} »`}
                        className={CLASSE_LIEN_ACTION}
                      >
                        <Icon name="edit" className="text-base" />
                        <span className={TEXTE_SOULIGNE}>Modifier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApercu(n)}
                        aria-haspopup="dialog"
                        aria-label={`Aperçu du brouillon « ${n.title} »`}
                        className={CLASSE_LIEN_ACTION}
                      >
                        <Icon name="visibility" className="text-base" />
                        <span className={TEXTE_SOULIGNE}>Aperçu</span>
                      </button>
                    </div>
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
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        CLASSE_BOUTON_CARTE,
                        "text-sm",
                      )}
                    >
                      Publier
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LienBasBloc to="/actualites" align="centre">
            Voir toutes mes actualités
          </LienBasBloc>
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
          {published.slice(0, 4).map((n) => {
            // Ses propres actualités : badge « Toi » et, à côté, son rôle et son équipe (connus pour soi seulement)
            const moi = !!email && (n.author_email ?? "").toLowerCase() === email.toLowerCase();
            const roleEquipe = moi ? [ROLE_LIBELLE[role], equipe].filter(Boolean).join(" ") : "";
            // Admin : toutes ; manager : ses propres actualités (la base refuse le reste)
            const peutModifier = isAdmin || (canWrite && moi);
            return (
              <li
                key={n.id}
                className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-sm gap-y-xs border-t border-outline-variant pt-sm first:border-t-0 first:pt-0"
              >
                <time
                  dateTime={n.created_at}
                  className="font-label-sm text-sm text-on-surface-variant"
                >
                  {formatDateCourte(n.created_at)}
                </time>
                {/* Vignette (si image) et texte côte à côte ; les actions sont sous le bloc, à partir de la colonne 2 */}
                <div className="flex min-w-0 gap-sm">
                  {n.image_path && <NewsVignette path={n.image_path} alt={n.title} />}
                  <div className="min-w-0 flex-1 space-y-xs">
                    <p className="font-body-md font-bold text-primary wrap-anywhere">{n.title}</p>
                    <p className="flex flex-wrap items-center gap-x-xs font-label-sm text-sm text-on-surface-variant">
                      <span>
                        <AuteurActualite news={n} noms={noms} />
                      </span>
                      {moi && <EtiquetteSoi>Toi</EtiquetteSoi>}
                      {moi && roleEquipe && <span>{`· ${roleEquipe}`}</span>}
                    </p>
                    <NewsLinks links={n.links} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLue(n)}
                  aria-haspopup="dialog"
                  aria-label={`Lire l'actualité « ${n.title} »`}
                  className={`${CLASSE_LIEN_ACTION} shrink-0 self-start`}
                >
                  <span className={TEXTE_SOULIGNE}>Lire</span>
                  <Icon name="chevron_right" className="text-base" />
                </button>
                {peutModifier && (
                  <div className="col-start-2 flex flex-wrap items-center gap-md">
                    <button
                      type="button"
                      onClick={() => ouvrir(n)}
                      aria-label={`Modifier l'actualité « ${n.title} »`}
                      className={CLASSE_LIEN_ACTION}
                    >
                      <Icon name="edit" className="text-base" />
                      <span className={TEXTE_SOULIGNE}>Modifier</span>
                    </button>
                    <button
                      type="button"
                      disabled={supprimer.isPending}
                      onClick={() => confirmerSuppression(n)}
                      aria-label={`Supprimer l'actualité « ${n.title} »`}
                      className={CLASSE_LIEN_SUPPRIMER}
                    >
                      <Icon name="delete" className="text-base" />
                      <span className={TEXTE_SOULIGNE}>Supprimer</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {published.length > 0 && (
          <LienBasBloc to="/actualites" align="centre">
            Voir toutes les actualités
          </LienBasBloc>
        )}
      </div>

      {editeur && (
        <NewsEditor
          news={editeur.news}
          isAdmin={isAdmin}
          email={email}
          auteur={auteur}
          roleEquipe={[ROLE_LIBELLE[role], equipe].filter(Boolean).join(" ")}
          onFermer={fermer}
        />
      )}

      <NewsReader news={lue} onClose={() => setLue(null)} />
      <NewsReader
        news={apercu}
        apercu
        onClose={() => setApercu(null)}
        pied={
          apercu && (
            <>
              <button
                type="button"
                onClick={() => setApercu(null)}
                className={buttonVariants({ variant: "secondary" })}
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={publier.isPending}
                onClick={async () => {
                  const n = apercu;
                  // La fenêtre d'aperçu se ferme avant la confirmation : deux fenêtres ne se superposent pas
                  setApercu(null);
                  if (
                    await demander({
                      titre: "Publier l'actualité",
                      message: `Publier l'actualité « ${n.title} » ? Elle sera visible par tous.`,
                      libelleConfirmer: "Publier",
                    })
                  )
                    publier.mutate(n.id);
                }}
                className={buttonVariants({ variant: "default" })}
              >
                Publier
              </button>
            </>
          )
        }
      />
      {dialogueConfirm}
    </section>
  );
}
