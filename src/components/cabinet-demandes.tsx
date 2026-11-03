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

/** Accueil : 10 dernières demandes, avec un lien vers la page complète. Page /demandes : 20, puis 20 de plus. */
const PAGE_ACCUEIL = 10;
const PAGE_COMPLETE = 20;

type Filtre = "toutes" | "mes" | "pj";
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "mes", libelle: "Mes demandes" },
  { valeur: "pj", libelle: "Avec pièce jointe" },
];

/**
 * Mise en page : sous 640 px, chaque demande est une carte (grille : type et date, auteur et texte, statut et
 * visibilité). De 640 à 900 px, un tableau à quatre colonnes, la visibilité sous le statut. Dès 900 px, cinq colonnes.
 */
const LIGNE =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-sm gap-y-xs border-b border-outline-variant py-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-[640px]:table-row min-[640px]:py-0";
const CELLULE = "min-w-0 align-middle min-[640px]:px-xs min-[640px]:py-sm";
/** Demande en attente (ou à clarifier) depuis plus de 4 jours : date en rouge. */
const SEUIL_ATTENTE_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * « 10 dernières demandes du cabinet » (accueil) ou tableau complet (page /demandes) : tous statuts, les plus
 * récentes d'abord. Les règles d'accès (RLS) décident de ce qui est visible : les demandes privées des autres
 * équipes n'apparaissent pas.
 */
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
  const premiereAjoutee = useRef<HTMLTableRowElement>(null);

  const toutes = useMemo(() => q.data ?? [], [q.data]);
  const equipes = useMemo(
    () => [...new Set(toutes.map((s) => s.team))].sort((a, b) => a.localeCompare(b, "fr")),
    [toutes],
  );
  const filtrees = toutes.filter(
    (s) =>
      (filtre === "toutes" || (filtre === "mes" ? estMoi(s) : !!s.attachment_path)) &&
      (!equipe || s.team === equipe),
  );
  const visibles = filtrees.slice(0, limite);

  // Après « Afficher 20 de plus », le focus va sur la première ligne ajoutée
  useEffect(() => {
    if (limite > PAGE) premiereAjoutee.current?.focus();
  }, [limite, PAGE]);

  function changerFiltre(f: Filtre) {
    setFiltre(f);
    setLimite(PAGE);
  }

  return (
    <section
      aria-labelledby="titre-cabinet"
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-sm min-[900px]:p-md"
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
          {FILTRES.map((f) => (
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
          className="flex min-h-11 items-center gap-xs font-label-sm text-sm text-on-surface"
        >
          <span>Équipe :</span>
          <select
            id="filtre-equipe-cabinet"
            name="equipe"
            value={equipe}
            onChange={(e) => {
              setEquipe(e.target.value);
              setLimite(PAGE);
            }}
            className="min-h-11 max-w-full border border-[#8A8A90] bg-card px-sm py-xs font-label-sm text-sm focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          Aucune demande ne correspond à ces filtres.
        </p>
      )}

      {visibles.length > 0 && (
        <div className="mt-md">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Dix dernières demandes du cabinet, de la plus récente à la plus ancienne
            </caption>
            <thead className="sr-only min-[640px]:not-sr-only">
              <tr className="border-b border-outline-variant bg-[#F5F4F1] font-label-sm text-sm text-on-surface-variant">
                <th scope="col" className="whitespace-nowrap px-xs py-xs font-semibold uppercase">
                  Catégorie
                </th>
                <th scope="col" className="px-xs py-xs font-semibold uppercase">
                  Auteur et demande
                </th>
                <th scope="col" className="whitespace-nowrap px-xs py-xs font-semibold uppercase">
                  Statut
                </th>
                <th
                  scope="col"
                  className="hidden whitespace-nowrap px-xs py-xs font-semibold uppercase min-[900px]:table-cell"
                >
                  Visibilité
                </th>
                <th scope="col" className="whitespace-nowrap px-xs py-xs font-semibold uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((s, i) => {
                const attenteLongue =
                  demandeEnAttente(s) &&
                  Date.now() - new Date(s.created_at).getTime() > SEUIL_ATTENTE_MS;
                return (
                  <tr
                    key={s.id}
                    ref={i === limite - PAGE ? premiereAjoutee : undefined}
                    tabIndex={-1}
                    className={LIGNE}
                  >
                    <td className={`${CELLULE} col-start-1 row-start-1`}>
                      {s.category ? (
                        <CategoryChip category={s.category} />
                      ) : (
                        <span className="text-on-surface-variant">Non renseignée</span>
                      )}
                    </td>
                    <td
                      className={`${CELLULE} col-span-2 row-start-2 w-full min-[640px]:col-auto min-[640px]:row-auto`}
                    >
                      <div className="min-w-0 min-[900px]:min-w-[15rem]">
                        <p className="flex min-w-0 flex-wrap items-center gap-x-xs font-body-sm font-bold text-primary break-normal">
                          <span>{`${s.author_name} · ${s.team}`}</span>
                          {estMoi(s) && <EtiquetteSoi>Moi</EtiquetteSoi>}
                        </p>
                        {/* Texte sur trois lignes au plus (il ne peut pas élargir le tableau), « Voir » toujours visible. */}
                        <div className="flex min-w-0 flex-wrap items-start gap-x-sm min-[640px]:flex-nowrap min-[640px]:items-center">
                          <span
                            className="line-clamp-3 min-w-0 break-words whitespace-normal min-[640px]:flex-1"
                            title={s.content}
                          >
                            {s.content}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRead(s)}
                            aria-haspopup="dialog"
                            aria-label={`Voir la demande de ${s.author_name}`}
                            className="inline-flex min-h-11 shrink-0 items-center font-label-sm text-sm text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    </td>
                    <td
                      className={`${CELLULE} whitespace-nowrap row-start-3 col-start-1 min-[640px]:row-auto min-[640px]:col-auto`}
                    >
                      <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
                      {/* Entre 640 et 900 px, la visibilité passe sous le statut, dans la même cellule */}
                      <div className="mt-xs hidden min-[640px]:block min-[900px]:hidden">
                        <VisibilityChip visibility={s.visibility} />
                      </div>
                    </td>
                    <td
                      className={`${CELLULE} row-start-3 col-start-2 justify-self-end whitespace-nowrap min-[640px]:hidden min-[900px]:table-cell`}
                    >
                      <VisibilityChip visibility={s.visibility} />
                    </td>
                    <td
                      className={`${CELLULE} row-start-1 col-start-2 justify-self-end whitespace-nowrap font-label-sm text-sm min-[640px]:justify-self-auto`}
                    >
                      <time
                        dateTime={s.created_at}
                        title={formatExactDate(s.created_at)}
                        className={
                          attenteLongue
                            ? "inline-flex items-center gap-xs font-semibold text-[#A81E25]"
                            : "text-on-surface-variant"
                        }
                      >
                        {attenteLongue && (
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[16px]"
                          >
                            schedule
                          </span>
                        )}
                        {dateCourteDemande(s.created_at)}
                        {attenteLongue && (
                          <span className="sr-only">, en attente depuis plus de 4 jours</span>
                        )}
                      </time>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
