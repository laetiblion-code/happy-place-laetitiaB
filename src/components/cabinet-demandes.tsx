import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { StatusBadge } from "@/components/status-badge";
import { EtiquetteSoi, LienBasBloc } from "@/components/chips";
import { formatExactDate } from "@/components/expandable-card";
import { buttonVariants } from "@/components/ui/button";
import { AttachmentLink } from "@/components/attachment-link";
import { cn } from "@/lib/utils";
import { fetchCabinetSubmissions, type Submission } from "@/lib/dashboard";
import { CLARIFY_CATEGORY } from "@/components/status-badge";
import { decouperContenu } from "@/lib/historique-demande";

/** Accueil : 10 dernières demandes, avec un lien vers la page complète. Page /demandes : 20, puis 20 de plus. */
const PAGE_ACCUEIL = 10;
const PAGE_COMPLETE = 20;

type Filtre = "toutes" | "mes" | "pj" | "retard";
/** « En retard » n'est proposé qu'aux managers et à l'admin (ils traitent les demandes). */
const FILTRES: { valeur: Filtre; libelle: string; reserveAuxManagers?: boolean }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "mes", libelle: "Mes demandes" },
  { valeur: "pj", libelle: "Avec pièce jointe" },
  { valeur: "retard", libelle: "En retard (+3 j)", reserveAuxManagers: true },
];

/**
 * Mise en page selon la largeur du bloc (requêtes de conteneur, pas de la fenêtre). Une seule grille pour tout le
 * tableau : le conteneur porte les colonnes (variable --colonnes), chaque ligne les reprend en sous-grille (subgrid).
 * Sans subgrid, chaque ligne reprend les mêmes largeurs fixes : l'alignement reste le même.
 * - moins de 700 px : une carte par demande (Catégorie et date ; auteur et texte ; statut ; visibilité) ;
 * - de 700 à 1000 px : trois colonnes, « Suivi » empile statut, visibilité et date ;
 * - 1000 px et plus : cinq colonnes (Catégorie 210 px, Auteur et demande, Statut 190 px, Visibilité 140 px, Date 56 px).
 * La sémantique reste celle d'un tableau (role table, row, columnheader, cell).
 */
const TABLEAU =
  "grid grid-cols-[var(--colonnes)] [--colonnes:minmax(0,1fr)_96px] @min-[700px]:[--colonnes:210px_minmax(0,1fr)_196px] @min-[1000px]:[--colonnes:210px_minmax(0,1fr)_190px_140px_56px]";
/** Ligne du tableau (en-tête compris) : pleine largeur, colonnes reprises du tableau. */
const LIGNE_GRILLE =
  "col-span-full grid grid-cols-[var(--colonnes)] supports-[grid-template-columns:subgrid]:grid-cols-subgrid gap-y-xs";
const LIGNE = `${LIGNE_GRILLE} border-b border-outline-variant py-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;
/** Marge horizontale : sépare les colonnes ; la colonne Catégorie est collée au bord (pl-0). */
const CELLULE = "min-w-0 self-center px-xs";
/** Demande en attente (ou à clarifier) depuis plus de 3 jours : date en rouge, filtre « En retard ». */
const SEUIL_ATTENTE_MS = 3 * 24 * 60 * 60 * 1000;

/** Date courte d'une demande : « 11 h », « 4 j ». L'heure exacte est dans le titre de la balise. */
function dateCourteDemande(iso: string, maintenant = Date.now()): string {
  const min = Math.round((maintenant - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min}\u00a0min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}\u00a0h`;
  return `${Math.round(h / 24)}\u00a0j`;
}

/** Demande en attente de traitement : en attente, ou à clarifier (refusée avec cette catégorie). */
function demandeEnAttente(s: Submission): boolean {
  return (
    s.status === "en attente" ||
    (s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY)
  );
}

/**
 * « 10 dernières demandes du cabinet » (accueil) ou tableau complet (page /demandes) : tous statuts, les plus
 * récentes d'abord. Les règles d'accès (RLS) décident de ce qui est visible : les demandes privées des autres
 * équipes n'apparaissent pas.
 */
export function DemandesCabinet({
  email,
  role,
  managerTeams,
  onRead,
  variante = "accueil",
}: {
  /** Adresse de la personne connectée, pour le filtre « Mes demandes ». */
  email: string;
  role: "admin" | "manager" | "collaborateur";
  /** Équipes gérées (manager) : elles donnent accès aux pièces jointes de ces équipes. */
  managerTeams: string[];
  onRead: (s: Submission) => void;
  /** accueil : bloc de 10 lignes et lien « Voir toutes » ; page : 20 lignes et « Afficher 20 de plus ». */
  variante?: "accueil" | "page";
}) {
  const PAGE = variante === "page" ? PAGE_COMPLETE : PAGE_ACCUEIL;
  /** Demande envoyée par la personne connectée. */
  function estMoi(s: Submission) {
    return (s.submitted_by_email ?? "").toLowerCase() === email;
  }
  /** Même règle que le stockage : admin, auteur, ou manager de l'équipe. */
  function peutLirePiece(s: Submission) {
    if (role === "admin") return true;
    if ((s.submitted_by_email ?? "").toLowerCase() === email) return true;
    return role === "manager" && managerTeams.includes(s.team);
  }

  const q = useQuery({
    queryKey: ["submissions", "cabinet"],
    queryFn: fetchCabinetSubmissions,
    retry: false,
  });
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [equipe, setEquipe] = useState("");
  const [limite, setLimite] = useState(PAGE);
  const premiereAjoutee = useRef<HTMLDivElement>(null);

  const maintenant = Date.now();
  /** En attente (ou à clarifier) depuis plus de 3 jours : même seuil que la date en rouge. */
  function attendLongtemps(s: Submission) {
    return demandeEnAttente(s) && maintenant - new Date(s.created_at).getTime() > SEUIL_ATTENTE_MS;
  }

  const toutes = useMemo(() => q.data ?? [], [q.data]);
  const equipes = useMemo(
    () => [...new Set(toutes.map((s) => s.team))].sort((a, b) => a.localeCompare(b, "fr")),
    [toutes],
  );
  const filtres = FILTRES.filter((f) => !f.reserveAuxManagers || role !== "collaborateur");
  function correspond(s: Submission) {
    if (filtre === "mes") return estMoi(s);
    if (filtre === "pj") return !!s.attachment_path;
    if (filtre === "retard") return attendLongtemps(s);
    return true;
  }
  const filtrees = toutes.filter((s) => correspond(s) && (!equipe || s.team === equipe));
  const visibles = filtrees.slice(0, limite);

  // Après « Afficher 20 de plus », le focus va sur la première ligne ajoutée
  useEffect(() => {
    if (limite > PAGE) premiereAjoutee.current?.focus();
  }, [limite, PAGE]);

  function changerFiltre(f: Filtre) {
    setFiltre(f);
    setLimite(PAGE);
  }

  const titreTableau =
    variante === "accueil"
      ? "Dix dernières demandes du cabinet, de la plus récente à la plus ancienne"
      : "Demandes du cabinet, de la plus récente à la plus ancienne";

  return (
    <section
      aria-labelledby="titre-cabinet"
      className="@container min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-sm min-[900px]:p-md"
    >
      {variante === "accueil" ? (
        <div className="space-y-xs border-b border-outline-variant pb-sm">
          <h2 id="titre-cabinet" className="font-headline-sm text-headline-sm text-primary">
            10 dernières demandes du cabinet
          </h2>
          <p className="font-body-md text-on-surface-variant">
            Les tiennes, celles de ton équipe et celles ouvertes à toute l'entreprise. Les demandes
            privées des autres équipes restent entre leur auteur et leur manager.
          </p>
        </div>
      ) : (
        <h2 id="titre-cabinet" className="sr-only">
          Demandes du cabinet
        </h2>
      )}

      <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
        <div role="group" aria-label="Filtrer les demandes" className="flex flex-wrap gap-xs">
          {filtres.map((f) => (
            <button
              key={f.valeur}
              type="button"
              aria-pressed={filtre === f.valeur}
              onClick={() => changerFiltre(f.valeur)}
              className={cn(
                buttonVariants({
                  variant: filtre === f.valeur ? "default" : "secondary",
                  size: "sm",
                }),
                "min-h-11 text-sm",
              )}
            >
              {f.libelle}
            </button>
          ))}
        </div>
        <label
          htmlFor="filtre-equipe-cabinet"
          className="flex min-h-11 min-w-0 max-w-full items-center gap-xs font-label-sm text-sm text-on-surface"
        >
          <span className="shrink-0">Équipe :</span>
          <select
            id="filtre-equipe-cabinet"
            name="equipe"
            value={equipe}
            onChange={(e) => {
              setEquipe(e.target.value);
              setLimite(PAGE);
            }}
            className="min-h-11 min-w-0 max-w-full border border-[#8A8A90] bg-card px-sm py-xs font-label-sm text-sm focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="">Toutes</option>
            {equipes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q.isError && (
        <p className="mt-md text-body-sm text-error">Les demandes du cabinet sont indisponibles.</p>
      )}
      {q.isSuccess && filtrees.length === 0 && (
        <p className="mt-md text-body-sm italic text-on-surface-variant">
          {filtre === "retard"
            ? "Aucune demande en retard."
            : "Aucune demande ne correspond à ces filtres."}
        </p>
      )}

      {visibles.length > 0 && (
        <div role="table" aria-label={titreTableau} className={cn(TABLEAU, "mt-md min-w-0")}>
          <div
            role="row"
            className={cn(
              LIGNE_GRILLE,
              "sr-only border-b border-outline-variant bg-[#F5F4F1] font-label-sm text-sm text-on-surface-variant @min-[700px]:not-sr-only",
            )}
          >
            <div
              role="columnheader"
              className="col-start-1 row-start-1 min-w-0 py-xs pl-0 pr-xs font-semibold uppercase"
            >
              Catégorie
            </div>
            <div
              role="columnheader"
              className="col-start-2 row-start-1 min-w-0 px-xs py-xs font-semibold uppercase"
            >
              Auteur et demande
            </div>
            <div
              role="columnheader"
              className="col-start-3 row-start-1 hidden min-w-0 px-xs py-xs font-semibold uppercase @min-[700px]:block @min-[1000px]:hidden"
            >
              Suivi
            </div>
            <div
              role="columnheader"
              className="col-start-3 row-start-1 hidden min-w-0 px-xs py-xs font-semibold uppercase @min-[1000px]:block"
            >
              Statut
            </div>
            <div
              role="columnheader"
              className="col-start-4 row-start-1 hidden min-w-0 px-xs py-xs font-semibold uppercase @min-[1000px]:block"
            >
              Visibilité
            </div>
            <div
              role="columnheader"
              className="col-start-5 row-start-1 hidden min-w-0 px-xs py-xs text-right font-semibold uppercase @min-[1000px]:block"
            >
              Date
            </div>
          </div>

          {visibles.map((s, i) => {
            const attenteLongue = attendLongtemps(s);
            return (
              <div
                key={s.id}
                role="row"
                ref={i === limite - PAGE ? premiereAjoutee : undefined}
                tabIndex={-1}
                className={LIGNE}
              >
                <div role="cell" className={cn(CELLULE, "col-start-1 row-start-1 pl-0")}>
                  {s.category ? (
                    <CategoryChip category={s.category} />
                  ) : (
                    <span className="text-on-surface-variant">Non renseignée</span>
                  )}
                </div>

                <div
                  role="cell"
                  className={cn(
                    CELLULE,
                    "col-span-2 col-start-1 row-start-2 @min-[700px]:col-span-1 @min-[700px]:col-start-2 @min-[700px]:row-span-3 @min-[700px]:row-start-1 @min-[1000px]:row-span-1",
                  )}
                >
                  <p className="flex min-w-0 flex-wrap items-center gap-x-xs font-body-sm font-bold text-primary break-normal">
                    <span>{`${s.author_name} · ${s.team}`}</span>
                    {estMoi(s) && <EtiquetteSoi>Moi</EtiquetteSoi>}
                  </p>
                  {/* Texte sur deux lignes au plus ; « Voir » est posé à la fin de la dernière ligne, dans la marge réservée */}
                  <div className="relative min-w-0">
                    <p
                      className="line-clamp-2 min-w-0 break-words pr-14 whitespace-normal"
                      title={decouperContenu(s.content).texte}
                    >
                      {decouperContenu(s.content).texte}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRead(s)}
                      aria-haspopup="dialog"
                      aria-label={`Voir la demande de ${s.author_name}`}
                      className="absolute bottom-0 right-0 inline-flex h-6 items-center bg-surface-container-lowest pl-xs font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="underline underline-offset-2">Voir</span>
                    </button>
                  </div>
                  {s.attachment_path &&
                    (peutLirePiece(s) ? (
                      <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
                    ) : (
                      <p className="font-label-sm text-sm text-on-surface-variant wrap-anywhere">
                        {`${s.attachment_name ?? "Pièce jointe"} · réservée à l'équipe`}
                      </p>
                    ))}
                </div>

                <div
                  role="cell"
                  className={cn(
                    CELLULE,
                    "col-start-1 row-start-3 @min-[700px]:col-start-3 @min-[700px]:row-start-1",
                  )}
                >
                  <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
                </div>

                <div
                  role="cell"
                  className={cn(
                    CELLULE,
                    "col-start-2 row-start-3 justify-self-end @min-[700px]:col-start-3 @min-[700px]:row-start-2 @min-[700px]:justify-self-start @min-[1000px]:col-start-4 @min-[1000px]:row-start-1",
                  )}
                >
                  <VisibilityChip visibility={s.visibility} />
                </div>

                <div
                  role="cell"
                  className={cn(
                    CELLULE,
                    "col-start-2 row-start-1 justify-self-end font-label-sm text-sm @min-[700px]:col-start-3 @min-[700px]:row-start-3 @min-[700px]:justify-self-start @min-[1000px]:col-start-5 @min-[1000px]:row-start-1 @min-[1000px]:justify-self-end",
                  )}
                >
                  <time
                    dateTime={s.created_at}
                    title={formatExactDate(s.created_at)}
                    className={cn(
                      "inline-flex items-center gap-xs whitespace-nowrap",
                      attenteLongue ? "font-semibold text-[#A81E25]" : "text-on-surface-variant",
                    )}
                  >
                    {attenteLongue && (
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                        schedule
                      </span>
                    )}
                    {dateCourteDemande(s.created_at, maintenant)}
                    {attenteLongue && (
                      <span className="sr-only">, en attente depuis plus de 3 jours</span>
                    )}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {variante === "accueil" && filtrees.length > 0 && (
        <div className="mt-md">
          <LienBasBloc to={role === "admin" ? "/manage/submissions" : "/demandes"} align="centre">
            {`Voir toutes les demandes (${filtrees.length})`}
          </LienBasBloc>
        </div>
      )}

      {variante === "page" && filtrees.length > limite && (
        <div className="mt-md">
          <LienBasBloc onClick={() => setLimite((l) => l + PAGE)} align="centre">
            {`Afficher ${Math.min(PAGE, filtrees.length - limite)} de plus`}
          </LienBasBloc>
        </div>
      )}
    </section>
  );
}
