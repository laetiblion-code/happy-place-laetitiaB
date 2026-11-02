import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { BlockerArchive } from "@/components/dashboard-extras";
import { buttonVariants } from "@/components/ui/button";
import {
  ALERT_STATES,
  ALERT_TRANSITIONS,
  SEVERITY_STYLES,
  isAlertStatus,
  type AlertStatus,
} from "@/lib/alert-states";
import {
  fetchAllBlockers,
  formatDateCourte,
  updateBlockerStatus,
  type Blocker,
} from "@/lib/dashboard";

const JOURS_RESOLUES = 30;

/** Colonnes du tableau, dans l'ordre. « Résolues » ne garde que les 30 derniers jours. */
const COLONNES: { etat: AlertStatus; titre: string }[] = [
  { etat: "OUVERT", titre: "Ouvertes" },
  { etat: "EN COURS", titre: "En cours" },
  { etat: "SURVEILLANCE", titre: "Sous surveillance" },
  { etat: "RÉSOLU", titre: `Résolues sur ${JOURS_RESOLUES} j` },
];

/** Couleurs de sévérité propres au tableau : critique en rouge, avertissement en sable, information en gris. */
const SEVERITE = {
  critical: { label: "Critique", icon: "error", classe: "bg-[#FFDAD6] text-[#A81E25]" },
  warning: { label: "Avertissement", icon: "warning", classe: "bg-[#F0D0BC] text-[#28282D]" },
  info: { label: "Information", icon: "info", classe: "bg-[#EDEBE6] text-[#28282D]" },
} as const;

type Severite = keyof typeof SEVERITE;

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** État d'une alerte dans le tableau. Un état inconnu de la base est rangé avec les ouvertes. */
function colonneDe(b: Blocker, debutResolues: number): AlertStatus | null {
  if (b.status === "RÉSOLU")
    return new Date(b.updated_at).getTime() >= debutResolues ? "RÉSOLU" : null;
  return isAlertStatus(b.status) ? b.status : "OUVERT";
}

/**
 * Alertes opérationnelles en quatre colonnes (accueil, tous les rôles).
 * Seul l'admin change l'état : glisser-déposer entre colonnes, ou le bouton « Changer l'état » (clavier).
 * Les colonnes et passages refusés par ALERT_TRANSITIONS ne réagissent pas. Si la base refuse, la carte reste à sa place.
 */
export function AlertsKanban({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [archiveOuverte, setArchiveOuverte] = useState(false);
  const [glissee, setGlissee] = useState<Blocker | null>(null);
  const [survol, setSurvol] = useState<AlertStatus | null>(null);
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState("");

  const alertes = useQuery({
    queryKey: ["blockers", "tableau"],
    queryFn: fetchAllBlockers,
    retry: false,
  });

  const changer = useMutation({
    mutationFn: (v: { id: string; status: AlertStatus }) =>
      updateBlockerStatus({ id: v.id, status: v.status }),
    onSuccess: (_d, v) => {
      setAnnonce(`Alerte déplacée vers ${ALERT_STATES[v.status].label}`);
      setMenuOuvert(null);
      qc.invalidateQueries({ queryKey: ["blockers"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e) => {
      const message = (e as Error).message;
      setAnnonce(`Changement refusé : ${message}`);
      toast.error(message);
    },
  });

  /** Passage autorisé depuis l'état de l'alerte vers la colonne visée. */
  function passageAutorise(b: Blocker, cible: AlertStatus) {
    return isAlertStatus(b.status) && ALERT_TRANSITIONS[b.status].includes(cible);
  }

  function deposer(cible: AlertStatus) {
    const b = glissee;
    setGlissee(null);
    setSurvol(null);
    if (!b || !passageAutorise(b, cible)) return;
    changer.mutate({ id: b.id, status: cible });
  }

  // Résolues : seulement les 30 derniers jours (la base garde la date de la dernière mise à jour)
  const debutResolues = Date.now() - JOURS_RESOLUES * 86_400_000;
  const liste = alertes.data ?? [];
  const parColonne = (etat: AlertStatus) =>
    liste.filter((b) => colonneDe(b, debutResolues) === etat);

  return (
    <section
      id="alertes"
      aria-labelledby="titre-alertes"
      className="scroll-mt-4 min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-md"
    >
      <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <h2 id="titre-alertes" className="font-headline-sm text-headline-sm text-primary">
            Alertes opérationnelles
          </h2>
          <span className="inline-flex items-center gap-xs rounded-full bg-error-container px-sm py-[2px] font-label-sm text-sm text-on-error-container">
            <Icon name="priority_high" className="text-base" />
            Priorité haute
          </span>
        </div>
        {isAdmin && (
          <p className="font-body-sm text-sm text-on-surface-variant">
            Glisse une carte vers une autre colonne, ou utilise « Changer l'état ».
          </p>
        )}
      </div>

      {/* Annonce des changements pour les lecteurs d'écran */}
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>

      {alertes.isError && (
        <p className="mb-md text-body-sm text-error">Les alertes sont indisponibles.</p>
      )}

      {/* Petit écran : défilement horizontal à l'intérieur du bloc. Grand écran : quatre colonnes. */}
      <div className="flex gap-sm overflow-x-auto pb-xs md:grid md:grid-cols-4 md:overflow-visible">
        {COLONNES.map((col) => {
          const cartes = parColonne(col.etat);
          const autorisee = !!glissee && passageAutorise(glissee, col.etat);
          const cibleActive = survol === col.etat && autorisee;
          return (
            <div
              key={col.etat}
              aria-labelledby={`colonne-${col.etat}`}
              onDragOver={(e) => {
                if (!autorisee) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (survol !== col.etat) setSurvol(col.etat);
              }}
              onDragLeave={() => setSurvol((s) => (s === col.etat ? null : s))}
              onDrop={(e) => {
                if (!autorisee) return;
                e.preventDefault();
                deposer(col.etat);
              }}
              className={`flex w-64 shrink-0 flex-col gap-sm rounded-md bg-[#EDEBE6] p-sm md:w-auto md:min-w-0 ${cibleActive ? "outline outline-2 outline-offset-2 outline-[#28282D]" : ""}`}
            >
              <h3
                id={`colonne-${col.etat}`}
                className="font-label-md text-[16px] font-semibold normal-case tracking-normal text-[#28282D]"
              >
                {`${col.titre} (${cartes.length})`}
              </h3>

              {cartes.length === 0 && (
                <p className="font-body-sm text-sm italic text-on-surface-variant">
                  Aucune alerte dans cet état
                </p>
              )}

              <ul className="flex flex-col gap-sm">
                {cartes.map((b) => (
                  <CarteAlerte
                    key={b.id}
                    b={b}
                    isAdmin={isAdmin}
                    enCours={changer.isPending && changer.variables?.id === b.id}
                    menuOuvert={menuOuvert === b.id}
                    onToggleMenu={() => setMenuOuvert((m) => (m === b.id ? null : b.id))}
                    onChoisir={(etat) => changer.mutate({ id: b.id, status: etat })}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", b.id);
                      e.dataTransfer.effectAllowed = "move";
                      setGlissee(b);
                    }}
                    onDragEnd={() => {
                      setGlissee(null);
                      setSurvol(null);
                    }}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-md flex justify-end">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setArchiveOuverte(true)}
          className="inline-flex min-h-11 items-center font-label-sm text-sm font-bold text-primary underline underline-offset-4 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Voir les alertes archivées →
        </button>
      </div>

      <BlockerArchive open={archiveOuverte} onClose={() => setArchiveOuverte(false)} />
    </section>
  );
}

function CarteAlerte({
  b,
  isAdmin,
  enCours,
  menuOuvert,
  onToggleMenu,
  onChoisir,
  onDragStart,
  onDragEnd,
}: {
  b: Blocker;
  isAdmin: boolean;
  enCours: boolean;
  menuOuvert: boolean;
  onToggleMenu: () => void;
  onChoisir: (etat: AlertStatus) => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}) {
  const sev = SEVERITE[b.severity as Severite] ?? SEVERITE.info;
  const critique = b.severity === "critical";
  const resolue = b.status === "RÉSOLU";
  const etat = isAlertStatus(b.status) ? ALERT_STATES[b.status] : null;
  const transitions = isAlertStatus(b.status) ? ALERT_TRANSITIONS[b.status] : [];
  const modifiable = isAdmin && transitions.length > 0;
  const idMenu = `menu-etat-${b.id}`;

  return (
    <li
      draggable={modifiable}
      onDragStart={modifiable ? onDragStart : undefined}
      onDragEnd={modifiable ? onDragEnd : undefined}
      aria-busy={enCours || undefined}
      className={`flex min-w-0 flex-col gap-xs rounded-md border border-outline-variant p-sm shadow-sm ${critique ? "bg-[#FDF0EF]" : "bg-white"} ${resolue ? "border-t-4 border-t-[#1F6B38]" : ""} ${modifiable ? "cursor-grab" : ""}`}
    >
      <div className="flex items-start justify-between gap-xs">
        <span
          className={`inline-flex min-h-7 items-center gap-xs rounded-full px-sm py-xs font-label-sm text-sm font-semibold ${sev.classe}`}
        >
          <Icon name={sev.icon} className="text-base" />
          {sev.label}
        </span>
        {modifiable && <Icon name="drag_indicator" className="text-on-surface-variant" />}
      </div>

      <p className="font-body-md font-bold text-primary wrap-anywhere">{b.title}</p>
      <p className="font-label-sm text-sm text-[#68686D] wrap-anywhere">{b.department}</p>
      {!etat && <p className="font-label-sm text-sm text-on-surface">{`État : ${b.status}`}</p>}

      <hr className="border-t border-[#CDCDD1]" />
      <p className="font-label-sm text-sm text-[#68686D]">
        {`Créé le ${formatDateCourte(b.created_at)} · Mis à jour le ${formatDateCourte(b.updated_at)}`}
      </p>

      {modifiable && (
        <div className="space-y-xs">
          <button
            type="button"
            aria-expanded={menuOuvert}
            aria-controls={idMenu}
            onClick={onToggleMenu}
            disabled={enCours}
            className={`${buttonVariants({ variant: "secondary", size: "sm" })} min-h-11 w-full`}
          >
            <Icon name="swap_horiz" className="text-base" />
            {enCours ? "Changement…" : "Changer l'état"}
          </button>
          {menuOuvert && (
            <ul id={idMenu} aria-label="États autorisés" className="space-y-xs">
              {transitions.map((etatCible) => (
                <li key={etatCible}>
                  <button
                    type="button"
                    onClick={() => onChoisir(etatCible)}
                    className="flex min-h-11 w-full items-center gap-xs rounded-md border border-outline-variant bg-card px-sm font-label-sm text-sm text-on-surface hover:border-[#28282D] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Icon name={ALERT_STATES[etatCible].icon} className="text-base" />
                    {`Passer à « ${ALERT_STATES[etatCible].label} »`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
