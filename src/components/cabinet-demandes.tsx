import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle } from "lucide-react";
import { VisibilityChip, SUBMISSION_CATEGORY_OPTIONS } from "@/components/submission-choices";
import {
  attendLongtemps,
  correspondFiltre,
  FILTRES,
  FiltresDemandes,
  type Filtre,
} from "@/components/filtres-demandes";
import { StatusBadge } from "@/components/status-badge";
import { EtiquetteSoi, LienBasBloc } from "@/components/chips";
import { formatExactDate } from "@/components/expandable-card";
import { AttachmentLink } from "@/components/attachment-link";
import { cn } from "@/lib/utils";
import { fetchCabinetSubmissions, type Submission } from "@/lib/dashboard";
import { decouperContenu } from "@/lib/historique-demande";

/** Demandes par bloc : 3 sur l'accueil (« Voir tout »), 10 sur la page (« Afficher 10 de plus »). */
const PAR_BLOC_ACCUEIL = 3;
const PAR_BLOC_PAGE = 10;


/**
 * Types des adresses `/demandes?type=…` (slugs), dans l'ordre de l'accueil.
 */
export const TYPES_DEMANDE = ["idee", "amelioration", "question", "probleme"] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

/**
 * Blocs par type. Le bloc « Sans type » (demandes antérieures au 2026-10-31) n'existe que sur la page complète,
 * et seulement s'il reste des demandes sans type.
 */
const SANS_TYPE = "sans-type";
const BLOCS: { slug: string; categorie: string | null; titre: string; info?: string }[] = [
  {
    slug: "idee",
    categorie: "idée",
    titre: "Boîte à idées",
    info: "Bientôt la possibilité de liker et noter les idées qui te plaisent le plus.",
  },
  { slug: "amelioration", categorie: "amélioration de Happy Place", titre: "Améliorer Happy Place" },
  { slug: "question", categorie: "question", titre: "Questions" },
  { slug: "probleme", categorie: "problème", titre: "Problèmes" },
  { slug: SANS_TYPE, categorie: null, titre: "Sans type" },
];

/** Date courte d'une demande : « 11 h », « 4 j ». L'heure exacte est dans le titre de la balise. */
function dateCourteDemande(iso: string, maintenant = Date.now()): string {
  const min = Math.round((maintenant - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min}\u00a0min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}\u00a0h`;
  return `${Math.round(h / 24)}\u00a0j`;
}

/** Slug du bloc d'une demande (son type, ou « Sans type »). */
function blocDe(s: Submission): string {
  const bloc = BLOCS.find((b) => b.categorie !== null && b.categorie === s.category);
  return bloc ? bloc.slug : SANS_TYPE;
}

function plurielDemandes(n: number): string {
  return n === 1 ? "1 demande" : `${n} demandes`;
}

/**
 * « Demandes du cabinet » : tous statuts, les plus récentes d'abord, rangées par type dans quatre blocs (accueil) ou
 * dans le bloc du type demandé (page /demandes?type=…). Les règles d'accès (RLS) décident de ce qui est visible.
 */
export function DemandesCabinet({
  email,
  role,
  managerTeams,
  onRead,
  variante = "accueil",
  typeChoisi,
}: {
  /** Adresse de la personne connectée, pour le filtre « Mes demandes ». */
  email: string;
  role: "admin" | "manager" | "collaborateur";
  /** Équipes gérées (manager) : elles donnent accès aux pièces jointes de ces équipes. */
  managerTeams: string[];
  onRead: (s: Submission) => void;
  /** accueil : quatre blocs, trois cartes chacun ; page : dix cartes par bloc, et un seul bloc si un type est choisi. */
  variante?: "accueil" | "page";
  /** Page seulement : slug du type affiché, seul bloc affiché en pleine largeur. */
  typeChoisi?: TypeDemande | null;
}) {
  const PAR_BLOC = variante === "page" ? PAR_BLOC_PAGE : PAR_BLOC_ACCUEIL;
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
  /** Nombre de cartes affiché par bloc (slug → limite), réinitialisé à chaque changement de filtre. */
  const [limites, setLimites] = useState<Record<string, number>>({});
  /** Id de la carte à mettre au focus après « Afficher 10 de plus ». */
  const aFocaliser = useRef<string | null>(null);

  useEffect(() => {
    if (!aFocaliser.current) return;
    document.getElementById(aFocaliser.current)?.focus();
    aFocaliser.current = null;
  });

  const maintenant = Date.now();
  const enRetard = (s: Submission) => attendLongtemps(s, maintenant);

  const toutes = q.data ?? [];
  const equipes = [...new Set(toutes.map((s) => s.team))].sort((a, b) => a.localeCompare(b, "fr"));
  const filtres = FILTRES.filter((f) => !f.reserveAuxManagers || role !== "collaborateur");
  const filtrees = toutes.filter(
    (s) => correspondFiltre(s, filtre, email, maintenant) && (!equipe || s.team === equipe),
  );
  const groupes: Record<string, Submission[]> = {};
  for (const s of filtrees) (groupes[blocDe(s)] ??= []).push(s);

  function changerFiltre(f: Filtre) {
    setFiltre(f);
    setLimites({});
  }

  // Blocs affichés : un seul si un type est demandé ; « Sans type » seulement sur la page, s'il reste des demandes
  const blocs = BLOCS.filter((b) => {
    if (typeChoisi) return b.slug === typeChoisi;
    if (b.slug === SANS_TYPE) return variante === "page" && (groupes[SANS_TYPE]?.length ?? 0) > 0;
    return true;
  });
  const pleineLargeur = blocs.length === 1;

  function voirPlus(slug: string, limite: number) {
    aFocaliser.current = `carte-${slug}-${limite}`;
    setLimites((l) => ({ ...l, [slug]: limite + PAR_BLOC }));
  }

  return (
    <section
      aria-labelledby="titre-cabinet"
      className="@container min-w-0 space-y-md rounded-lg border border-outline-variant bg-surface-container-lowest p-sm min-[900px]:p-md"
    >
      {variante === "accueil" ? (
        <div className="space-y-xs border-b border-outline-variant pb-sm">
          <h2 id="titre-cabinet" className="font-headline-sm text-headline-sm text-primary">
            Demandes du cabinet
          </h2>
          <p className="font-body-md text-on-surface-variant">
            Les tiennes, celles de ton équipe et celles ouvertes à toute l'entreprise, rangées par
            type. Les demandes privées des autres équipes restent entre leur auteur et leur manager.
          </p>
        </div>
      ) : (
        <h2 id="titre-cabinet" className="sr-only">
          Demandes du cabinet
        </h2>
      )}

      <FiltresDemandes
        filtres={filtres}
        filtre={filtre}
        onFiltre={changerFiltre}
        equipe={equipe}
        equipes={equipes}
        onEquipe={(e) => {
          setEquipe(e);
          setLimites({});
        }}
        idEquipe="filtre-equipe-cabinet"
      />

      {q.isError && (
        <p className="text-body-sm text-error">Les demandes du cabinet sont indisponibles.</p>
      )}
      {q.isSuccess && filtrees.length === 0 && filtre === "retard" && (
        <p className="text-body-sm italic text-on-surface-variant">Aucune demande en retard.</p>
      )}

      {q.isSuccess && (
        <div
          className={cn(
            "grid gap-sm",
            // Deux colonnes dès 640 px (sinon une), dans l'ordre : idées et amélioration, puis questions et problèmes
            !pleineLargeur && "grid-cols-1 @min-[640px]:grid-cols-2",
          )}
        >
          {blocs.map((bloc) => {
            const items = groupes[bloc.slug] ?? [];
            const limite = limites[bloc.slug] ?? PAR_BLOC;
            const visibles = items.slice(0, limite);
            const titreId = `titre-bloc-${bloc.slug}`;
            const Icone = SUBMISSION_CATEGORY_OPTIONS.find((o) => o.value === bloc.categorie)?.icon ?? Circle;
            return (
              <section
                key={bloc.slug}
                aria-labelledby={titreId}
                className="flex min-w-0 flex-col gap-sm rounded-md bg-[#EDEBE6] p-sm"
              >
                {/* En-tête de colonne : titre, nombre, puis un espace de 12 px et un trait fin */}
                <div className="flex flex-col gap-xs border-b border-[#CDCDD1] pb-[12px]">
                  <div className="flex items-center gap-xs">
                    <span
                      aria-hidden="true"
                      className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#28282D] text-white"
                    >
                      <Icone className="size-4" strokeWidth={2.25} />
                    </span>
                    <h3
                      id={titreId}
                      className="min-w-0 font-['Bodoni_Moda',Georgia,serif] text-[20px] font-medium leading-snug text-primary"
                    >
                      {bloc.titre}
                    </h3>
                    <span
                      role="img"
                      aria-label={plurielDemandes(items.length)}
                      className="ml-auto shrink-0 rounded-full bg-[#F5D5D4] px-sm text-[13px] font-bold tabular-nums text-on-surface"
                    >
                      {items.length}
                    </span>
                  </div>
                  {bloc.info && (
                    <p className="flex items-start gap-xs text-[13px] leading-snug text-on-surface-variant">
                      <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[16px]">
                        favorite
                      </span>
                      <span>{bloc.info}</span>
                    </p>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="px-xs py-md text-center font-body-sm italic text-on-surface-variant">
                    Aucune demande avec ces filtres.
                  </p>
                ) : (
                  <ul
                    className={cn(
                      "grid gap-sm",
                      pleineLargeur && "@min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-4",
                    )}
                  >
                    {visibles.map((s, i) => (
                      <li key={s.id} className="min-w-0">
                        <CarteDemande
                          id={`carte-${bloc.slug}-${i}`}
                          s={s}
                          maintenant={maintenant}
                          attenteLongue={enRetard(s)}
                          moi={estMoi(s)}
                          pieceLisible={!!s.attachment_path && peutLirePiece(s)}
                          onRead={onRead}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {variante === "accueil" && items.length > PAR_BLOC_ACCUEIL && (
                  <LienBasBloc
                    to={role === "admin" ? "/manage/submissions" : "/demandes"}
                    search={role === "admin" ? undefined : { type: bloc.slug }}
                    align="centre"
                  >
                    {`Voir tout (${items.length})`}
                  </LienBasBloc>
                )}

                {variante === "page" && items.length > limite && (
                  <LienBasBloc onClick={() => voirPlus(bloc.slug, limite)} align="centre">
                    {`Afficher ${Math.min(PAR_BLOC_PAGE, items.length - limite)} de plus`}
                  </LienBasBloc>
                )}
              </section>
            );
          })}
        </div>
      )}

      {variante === "page" && typeChoisi && (
        <LienBasBloc to="/demandes" align="centre">
          Voir tous les types
        </LienBasBloc>
      )}
    </section>
  );
}

/** Carte d'une demande : auteur, extrait, « Voir », pièce jointe, puis statut, visibilité et date. */
function CarteDemande({
  id,
  s,
  maintenant,
  attenteLongue,
  moi,
  pieceLisible,
  onRead,
}: {
  id: string;
  s: Submission;
  maintenant: number;
  attenteLongue: boolean;
  moi: boolean;
  pieceLisible: boolean;
  onRead: (s: Submission) => void;
}) {
  // Le texte de la demande seulement : la partie « Réponse à la clarification : … » n'est pas affichée
  const texte = decouperContenu(s.content).texte;
  return (
    <article
      id={id}
      tabIndex={-1}
      className={cn(
        "flex h-full min-w-0 flex-col gap-xs rounded-md border border-outline-variant bg-white p-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        attenteLongue && "border-l-[3px] border-l-[#A81E25]",
      )}
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-xs text-[15px] leading-normal">
        <span className="min-w-0 font-bold text-primary [overflow-wrap:anywhere]">{s.author_name}</span>
        <span className="min-w-0 text-on-surface-variant [overflow-wrap:anywhere]">{`· ${s.team}`}</span>
        {moi && <EtiquetteSoi>Moi</EtiquetteSoi>}
      </p>
      <p
        className="line-clamp-3 min-w-0 text-[15px] leading-[1.5] [overflow-wrap:anywhere]"
        title={texte}
      >
        {texte}
      </p>
      {/* « Voir » juste sous le texte, sans espace supplémentaire */}
      <button
        type="button"
        onClick={() => onRead(s)}
        aria-haspopup="dialog"
        aria-label={`Voir la demande de ${s.author_name}`}
        className="-mt-[10px] inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-on-surface focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="underline underline-offset-2">Voir</span>
      </button>
      {s.attachment_path &&
        (pieceLisible ? (
          <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
        ) : (
          <p className="text-[13px] text-on-surface-variant [overflow-wrap:anywhere]">
            {`${s.attachment_name ?? "Pièce jointe"} · réservée à l'équipe`}
          </p>
        ))}

      <div className="mt-auto flex flex-wrap items-center gap-xs border-t border-outline-variant pt-xs text-[13px]">
        <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
        <VisibilityChip visibility={s.visibility} />
        <time
          dateTime={s.created_at}
          title={formatExactDate(s.created_at)}
          className={cn(
            "ml-auto inline-flex items-center gap-xs whitespace-nowrap text-[13px]",
            attenteLongue ? "font-semibold text-[#A81E25]" : "text-on-surface-variant",
          )}
        >
          {attenteLongue && (
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              schedule
            </span>
          )}
          {dateCourteDemande(s.created_at, maintenant)}
          {attenteLongue && <span className="sr-only">, en attente depuis plus de 3 jours</span>}
        </time>
      </div>
    </article>
  );
}
