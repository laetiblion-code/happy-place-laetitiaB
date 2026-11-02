import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CategoryChip, VisibilityChip } from "@/components/submission-choices";
import { StatusBadge } from "@/components/status-badge";
import { LienBasBloc } from "@/components/chips";
import { formatExactDate } from "@/components/expandable-card";
import { buttonVariants } from "@/components/ui/button";
import { AttachmentLink } from "@/components/attachment-link";
import { cn } from "@/lib/utils";
import { fetchCabinetSubmissions, type Submission } from "@/lib/dashboard";
import { ilYaCourt } from "@/lib/noms";

/** Accueil : 10 dernières demandes, avec un lien vers la page complète. Page /demandes : 20, puis 20 de plus. */
const PAGE_ACCUEIL = 10;
const PAGE_COMPLETE = 20;

type Filtre = "toutes" | "mes" | "pj";
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "mes", libelle: "Mes demandes" },
  { valeur: "pj", libelle: "Avec pièce jointe" },
];

const CELLULE = "block px-sm py-xs align-middle md:table-cell md:px-sm md:py-sm";
/** Sur petit écran, chaque cellule affiche son nom de colonne avant la valeur. */
const ETIQUETTE =
  "before:mb-xs before:block before:font-label-sm before:text-sm before:uppercase before:text-on-surface-variant before:content-[attr(data-label)] md:before:hidden";

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
      (filtre === "toutes" ||
        (filtre === "mes"
          ? (s.submitted_by_email ?? "").toLowerCase() === email
          : !!s.attachment_path)) &&
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
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
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
          <table className="w-full border-collapse text-left md:table-fixed">
            {/* Largeurs fixes pour Catégorie, Statut, Visibilité et Date ; Auteur prend le reste */}
            <colgroup>
              <col className="md:w-[220px]" />
              <col />
              <col className="md:w-[180px]" />
              <col className="md:w-[150px]" />
              <col className="md:w-[90px]" />
            </colgroup>
            <caption className="sr-only">
              Dix dernières demandes du cabinet, de la plus récente à la plus ancienne
            </caption>
            <thead className="sr-only md:not-sr-only">
              <tr className="border-b border-outline-variant bg-[#F5F4F1] font-label-sm text-sm text-on-surface-variant">
                <th scope="col" className="px-sm py-xs font-semibold uppercase">
                  Catégorie
                </th>
                <th scope="col" className="px-sm py-xs font-semibold uppercase">
                  Auteur et demande
                </th>
                <th scope="col" className="px-sm py-xs font-semibold uppercase">
                  Statut
                </th>
                <th scope="col" className="px-sm py-xs font-semibold uppercase">
                  Visibilité
                </th>
                <th scope="col" className="px-sm py-xs font-semibold uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((s, i) => (
                <tr
                  key={s.id}
                  ref={i === limite - PAGE ? premiereAjoutee : undefined}
                  tabIndex={-1}
                  className="block border-b border-outline-variant py-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:table-row md:py-0"
                >
                  <td data-label="Catégorie" className={`${CELLULE} ${ETIQUETTE}`}>
                    {s.category ? (
                      <CategoryChip category={s.category} />
                    ) : (
                      <span className="text-on-surface-variant">Non renseignée</span>
                    )}
                  </td>
                  <td data-label="Auteur et demande" className={`${CELLULE} ${ETIQUETTE} min-w-0`}>
                    <p className="font-body-sm font-bold text-primary wrap-anywhere">
                      {`${s.author_name} · ${s.team}`}
                    </p>
                    {/* Texte tronqué sur une ligne ; « Voir » juste après (après les « … » s'il y en a) */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-sm">
                      <div className="flex min-w-0 max-w-full items-center gap-xs">
                        <span
                          className="min-w-0 truncate font-body-sm text-on-surface"
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
                  <td data-label="Statut" className={`${CELLULE} ${ETIQUETTE}`}>
                    <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
                  </td>
                  <td data-label="Visibilité" className={`${CELLULE} ${ETIQUETTE}`}>
                    <VisibilityChip visibility={s.visibility} />
                  </td>
                  <td
                    data-label="Date"
                    className={`${CELLULE} ${ETIQUETTE} font-label-sm text-sm text-on-surface-variant whitespace-nowrap`}
                  >
                    <time dateTime={s.created_at} title={formatExactDate(s.created_at)}>
                      {ilYaCourt(s.created_at)}
                    </time>
                  </td>
                </tr>
              ))}
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
