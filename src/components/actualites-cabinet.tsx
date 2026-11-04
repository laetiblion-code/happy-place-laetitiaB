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

/** Nombre d'actualités publiées sur l'accueil, puis par tranches de 10 sur la page « Actualités ». */
const APERCU_ACCUEIL = 4;
const TAILLE_PAGE = 10;

/**
 * Modifier une actualité publiée : admin sur toutes, manager sur les siennes (la base refuse le reste).
 * Le collaborateur ne modifie rien.
 */
export function peutModifierActualite(
  n: Pick<News, "author_email">,
  role: "admin" | "manager" | "collaborateur",
  email: string,
) {
  const moi = !!email && (n.author_email ?? "").toLowerCase() === email.toLowerCase();
  return role === "admin" || (role === "manager" && moi);
}

/**
 * Ligne d'une actualité publiée : date courte, vignette, titre, auteur, « Toi » et actions. Le même composant
 * sert l'accueil, la page « Actualités » et la colonne « Dernières actualités » du collaborateur.
 */
export function LigneActualite({
  news,
  noms,
  email,
  role,
  equipe = "",
  peutModifier,
  taille = "normale",
  idLire,
  onLire,
  onModifier,
  onSupprimer,
  supprimerPending = false,
}: {
  news: News;
  noms: Map<string, string> | undefined;
  email: string;
  role: "admin" | "manager" | "collaborateur";
  equipe?: string;
  peutModifier: boolean;
  /** Vignette : 72 px (maquette, accueil et page) ; 56 px dans la colonne « Dernières actualités ». */
  taille?: "normale" | "petite";
  /** Identifiant du bouton « Lire » (destination du focus après « Afficher 10 de plus »). */
  idLire?: string;
  onLire: (n: News) => void;
  onModifier?: (n: News) => void;
  onSupprimer?: (n: News) => void;
  supprimerPending?: boolean;
}) {
  // Ses propres actualités : badge « Toi » et, à côté, son rôle et son équipe (connus pour soi seulement)
  const moi = !!email && (news.author_email ?? "").toLowerCase() === email.toLowerCase();
  const roleEquipe = moi ? [ROLE_LIBELLE[role], equipe].filter(Boolean).join(" ") : "";
  return (
    <li className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-sm gap-y-xs border-t border-outline-variant pt-sm first:border-t-0 first:pt-0">
      <time dateTime={news.created_at} className="font-label-sm text-sm text-on-surface-variant">
        {formatDateCourte(news.created_at)}
      </time>
      {/* Vignette (si image) et texte côte à côte ; les actions sont sous le bloc, à partir de la colonne 2 */}
      <div className="flex min-w-0 gap-sm">
        {news.image_path && <NewsVignette path={news.image_path} alt={news.title} taille={taille} />}
        <div className="min-w-0 flex-1 space-y-xs">
          <p className="line-clamp-2 font-body-md font-bold text-primary wrap-anywhere">{news.title}</p>
          <p className="flex flex-wrap items-center gap-x-xs font-label-sm text-sm text-on-surface-variant">
            <span>
              <AuteurActualite news={news} noms={noms} />
            </span>
            {moi && <EtiquetteSoi>Toi</EtiquetteSoi>}
            {moi && roleEquipe && <span>{`· ${roleEquipe}`}</span>}
          </p>
          <NewsLinks links={news.links} />
        </div>
      </div>
      <button
        type="button"
        id={idLire}
        onClick={() => onLire(news)}
        aria-haspopup="dialog"
        aria-label={`Lire l'actualité « ${news.title} »`}
        className={`${CLASSE_LIEN_ACTION} shrink-0 self-start`}
      >
        <span className={TEXTE_SOULIGNE}>Lire</span>
        <Icon name="chevron_right" className="text-base" />
      </button>
      {peutModifier && (onModifier || onSupprimer) && (
        <div className="col-start-2 flex flex-wrap items-center gap-md">
          {onModifier && (
            <button
              type="button"
              onClick={() => onModifier(news)}
              aria-label={`Modifier l'actualité « ${news.title} »`}
              className={CLASSE_LIEN_ACTION}
            >
              <Icon name="edit" className="text-base" />
              <span className={TEXTE_SOULIGNE}>Modifier</span>
            </button>
          )}
          {onSupprimer && (
            <button
              type="button"
              disabled={supprimerPending}
              onClick={() => onSupprimer(news)}
              aria-label={`Supprimer l'actualité « ${news.title} »`}
              className={CLASSE_LIEN_SUPPRIMER}
            >
              <Icon name="delete" className="text-base" />
              <span className={TEXTE_SOULIGNE}>Supprimer</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * « Actualités du cabinet » (manager et admin). Mode « accueil » : titre de section, publiées récentes (4) et
 * brouillons à droite quand il y en a. Mode « page » : pas de titre (la page en porte un), 10 publiées par
 * tranches et même répartition. Les droits suivent les règles de la base.
 */
export function ActualitesCabinet({
  role,
  email,
  auteur,
  equipe = "",
  ouvertureDemandee = 0,
  mode = "accueil",
}: {
  role: "admin" | "manager" | "collaborateur";
  /** Adresse de la personne connectée (en minuscules). */
  email: string;
  /** Nom enregistré comme auteur des actualités. */
  auteur: string;
  /** Équipe de la personne connectée (affichée à côté de son rôle sur ses propres actualités). */
  equipe?: string;
  /** Compteur incrémenté depuis l'en-tête pour ouvrir la rédaction (« Nouvelle actualité » ou « Ajouter une actu »). */
  ouvertureDemandee?: number;
  mode?: "accueil" | "page";
}) {
  const qc = useQueryClient();
  const [demander, dialogueConfirm] = useConfirm();
  const isAdmin = role === "admin";
  const canWrite = role === "admin" || role === "manager";
  const page = mode === "page";
  // Titres : h2 sous le titre de page, h3 sous le titre de section de l'accueil
  const Titre = page ? "h2" : "h3";

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
  // Page : nombre d'actualités affichées, et index de la première ajoutée (focus)
  const [affichees, setAffichees] = useState(TAILLE_PAGE);
  const [focusSur, setFocusSur] = useState<number | null>(null);

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

  useEffect(() => {
    if (focusSur === null) return;
    document.getElementById(`actualite-${focusSur}`)?.focus();
    setFocusSur(null);
  }, [focusSur]);

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

  const visibles = page ? published.slice(0, affichees) : published.slice(0, APERCU_ACCUEIL);
  const avecBrouillons = canWrite && drafts.length > 0;

  const colonnePubliees = (
    <div className={cn("min-w-0 space-y-sm", avecBrouillons && "order-2 min-[1000px]:order-1")}>
      <Titre className="font-label-md text-label-md uppercase text-on-surface-variant">
        {page ? "Publiées" : "Publiées récemment"}
      </Titre>
      {news.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {news.isError && <p className="text-body-sm text-error">Les actualités sont indisponibles.</p>}
      {news.isSuccess && published.length === 0 && (
        <p className="font-body-sm italic text-on-surface-variant">
          Aucune actualité publiée pour le moment.
        </p>
      )}
      <ul className="space-y-sm">
        {visibles.map((n, i) => (
          <LigneActualite
            key={n.id}
            news={n}
            noms={noms}
            email={email}
            role={role}
            equipe={equipe}
            peutModifier={peutModifierActualite(n, role, email)}
            idLire={`actualite-${i}`}
            onLire={setLue}
            onModifier={(x) => ouvrir(x)}
            onSupprimer={confirmerSuppression}
            supprimerPending={supprimer.isPending}
          />
        ))}
      </ul>
      {page && affichees < published.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setFocusSur(affichees);
              setAffichees((n) => n + TAILLE_PAGE);
            }}
            className={buttonVariants({ variant: "secondary" })}
          >
            {`Afficher ${Math.min(TAILLE_PAGE, published.length - affichees)} de plus`}
          </button>
        </div>
      )}
      {!page && published.length > 0 && (
        <LienBasBloc to="/actualites" align="centre">
          Voir toutes les actualités
        </LienBasBloc>
      )}
    </div>
  );

  const colonneBrouillons = avecBrouillons && (
    <div
      className="order-1 min-w-0 space-y-sm rounded-md bg-surface-container p-sm min-[1000px]:order-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <Titre
          id="titre-brouillons"
          tabIndex={-1}
          className="font-label-md text-label-md uppercase text-on-surface-variant focus:outline-none"
        >
          {isAdmin ? "Tous les brouillons" : "Mes brouillons"}
        </Titre>
        <span className="rounded-full bg-tertiary-fixed px-sm py-[2px] font-label-sm text-sm tabular-nums text-on-tertiary-fixed">
          {`${drafts.length} en cours`}
        </span>
      </div>
      <ul className="space-y-xs">
        {drafts.map((n) => (
          <li key={n.id} className="flex flex-col gap-sm rounded-md border border-outline-variant bg-card p-sm">
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
      {!page && (
        <LienBasBloc to="/actualites" align="centre">
          Voir toutes mes actualités
        </LienBasBloc>
      )}
    </div>
  );

  const contenu = (
    <>
      {avecBrouillons ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-md min-[1000px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {colonnePubliees}
          {colonneBrouillons}
        </div>
      ) : (
        colonnePubliees
      )}
    </>
  );

  const modales = (
    <>
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
    </>
  );

  if (page) {
    return (
      <div className="flex min-w-0 flex-col gap-md">
        {contenu}
        {modales}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="titre-actus"
      className="flex min-w-0 flex-col gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant pb-sm">
        <h2
          id="titre-actus"
          tabIndex={-1}
          className="font-headline-sm text-headline-sm text-primary focus:outline-none"
        >
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
      {contenu}
      {modales}
    </section>
  );
}

/**
 * « Dernières actualités » du collaborateur (colonne de droite) : cinq publiées, même ligne que l'accueil
 * des autres rôles, sans action ni brouillon.
 */
export function DernieresActualites({ email }: { email: string }) {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const publiees = (news.data ?? []).filter((n) => n.status === "publiée");
  const noms = useNomsAffiches(
    publiees.flatMap((n) => [n.author ?? "", n.delegated_by_email ?? ""]),
  ).data;
  const [lue, setLue] = useState<News | null>(null);

  return (
    <section
      aria-labelledby="titre-dernieres-actus"
      className="flex min-w-0 flex-col gap-md rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <h2
        id="titre-dernieres-actus"
        className="border-b border-outline-variant pb-sm font-headline-sm text-headline-sm text-primary"
      >
        Dernières actualités
      </h2>
      {news.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {news.isError && <p className="text-body-sm text-error">Les actualités sont indisponibles.</p>}
      {news.isSuccess && publiees.length === 0 && (
        <p className="font-body-sm italic text-on-surface-variant">
          Aucune actualité publiée pour le moment.
        </p>
      )}
      <ul className="space-y-sm">
        {publiees.slice(0, 5).map((n) => (
          <LigneActualite
            key={n.id}
            news={n}
            noms={noms}
            email={email}
            role="collaborateur"
            peutModifier={false}
            taille="petite"
            onLire={setLue}
          />
        ))}
      </ul>
      {publiees.length > 0 && (
        <LienBasBloc to="/actualites" align="centre">
          Voir toutes les actualités
        </LienBasBloc>
      )}
      <NewsReader news={lue} onClose={() => setLue(null)} />
    </section>
  );
}
