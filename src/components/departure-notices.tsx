import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  downloadAttachment,
  downloadDepartureZip,
  fetchMyDepartureNotices,
  markDepartureNoticeDownloaded,
  type DepartureNotice,
  type Submission,
} from "@/lib/dashboard";
import {
  computeAdminGaps,
  fetchAdminDirectory,
  plural,
  teamKey,
  type AdminDirectory,
} from "@/lib/home-counts";
import { initialesDe, nomAffiche, useNomsAffiches } from "@/lib/noms";

const ROUGE = "text-[#A81E25]";
/** Départ dans ce délai (jours) : date et chip en rouge, avec un texte pour les lecteurs d'écran. */
const SEUIL_URGENT_JOURS = 7;

const FR_LONG = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const FR_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** « 2026-11-04 » : date de départ, lue en heure locale pour éviter le décalage d'un jour. */
function dateDepart(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}

/** Jours entre aujourd'hui et la date de départ (0 : aujourd'hui, négatif : passé). */
function joursAvant(ymd: string) {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((dateDepart(ymd).getTime() - aujourdhui.getTime()) / 86_400_000);
}

/**
 * Date limite de téléchargement, comme la règle d'origine : au départ pour un préavis,
 * sept jours après la création de l'avis pour un départ sans préavis.
 */
function dateLimite(n: DepartureNotice) {
  if (n.kind === "préavis") return dateDepart(n.departure_date);
  return new Date(new Date(n.created_at).getTime() + 7 * 86_400_000);
}

/** Prénom et nom lus dans l'annuaire admin ; l'adresse seulement si aucun nom n'est renseigné. */
function nomDeAnnuaire(u: { email: string; first_name: string | null; last_name: string | null }) {
  const nom = [u.first_name, u.last_name]
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return nom || u.email;
}

type LigneDepart = {
  notice: DepartureNotice;
  nom: string;
  initiales: string;
  /** Équipe connue : admin (annuaire) ou manager qui n'en gère qu'une. Sinon absente. */
  equipe: string | null;
  /** Managers de l'équipe, par prénom. Vide : équipe sans manager (admin seulement). null : inconnu. */
  managers: string[] | null;
  jours: number;
};

/**
 * Lignes d'affichage : nom, équipe, manager et délai.
 * Admin : équipe et managers lus dans l'annuaire. Manager : il ne voit que ses propres rattachements, donc
 * l'équipe n'est connue que s'il n'en gère qu'une, et le manager affiché est lui-même.
 */
function lignesDepart(
  notices: DepartureNotice[],
  noms: Map<string, string> | undefined,
  role: "admin" | "manager" | "collaborateur",
  moi: { email: string; equipesGerees: string[] },
  annuaire: AdminDirectory | undefined,
): LigneDepart[] {
  return notices.map((n) => {
    const nom = nomAffiche(n.departing_label, noms);
    let equipe: string | null = null;
    let managers: string[] | null = null;
    if (role === "admin" && annuaire) {
      const personne = annuaire.users.find(
        (u) => u.email.toLowerCase() === n.departing_label.toLowerCase(),
      );
      equipe = personne?.team ?? null;
      if (equipe) {
        const cle = teamKey(equipe);
        managers = annuaire.users
          .filter((u) => u.role === "manager" && u.managedTeams.some((t) => teamKey(t) === cle))
          .map((u) => nomDeAnnuaire(u));
      }
    } else if (role === "manager") {
      // Le manager ne voit que ses propres rattachements : une seule équipe gérée donne l'équipe.
      // Son propre nom n'est pas répété : la colonne Manager n'est pas affichée pour lui.
      equipe = moi.equipesGerees.length === 1 ? (moi.equipesGerees[0] ?? null) : null;
    }
    return {
      notice: n,
      nom,
      initiales: initialesDe(nom),
      equipe,
      managers,
      jours: joursAvant(n.departure_date),
    };
  });
}

export function DepartureNotices({
  email,
  role,
  equipesGerees,
  demandesEnAttente,
}: {
  email: string;
  role: "admin" | "manager" | "collaborateur";
  /** Équipes gérées par la personne (manager). */
  equipesGerees: string[];
  /** Demandes en attente que l'admin peut modérer : comptées par équipe sans manager. */
  demandesEnAttente?: Submission[];
}) {
  const isAdmin = role === "admin";
  const q = useQuery({
    queryKey: ["departure_notices", email.toLowerCase()],
    queryFn: () => fetchMyDepartureNotices(email),
  });
  const annuaire = useQuery({
    queryKey: ["admin-directory"],
    queryFn: fetchAdminDirectory,
    enabled: isAdmin,
    retry: false,
  });
  // Écarts d'organisation calculés sur le même annuaire que les départs (une seule lecture)
  const gaps = annuaire.data ? computeAdminGaps(annuaire.data) : undefined;
  const libelles = [...(q.data?.map((n) => n.departing_label) ?? []), email];
  const noms = useNomsAffiches(libelles).data;
  const lignes = lignesDepart(q.data ?? [], noms, role, { email, equipesGerees }, annuaire.data);

  if (isAdmin) {
    return (
      <BlocAdmin
        lignes={lignes}
        gaps={gaps}
        gapsError={annuaire.isError}
        demandesEnAttente={demandesEnAttente ?? []}
        email={email}
      />
    );
  }

  if (lignes.length === 0) return null;
  return (
    <section
      aria-labelledby="titre-departs"
      className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md space-y-sm"
    >
      <div className="space-y-xs">
        <h2 id="titre-departs" className="font-headline-sm text-headline-sm text-primary">
          Départs à venir
        </h2>
        {role === "manager" && (
          <p className="font-body-md text-on-surface-variant">
            {plural(
              lignes.length,
              "départ prévu dans tes équipes",
              "départs prévus dans tes équipes",
            )}
          </p>
        )}
      </div>
      <ListeDeparts lignes={lignes} email={email} />
    </section>
  );
}

/** Bloc admin « Utilisateurs et équipes à suivre » : départs du cabinet, équipes sans manager, sans équipe. */
function BlocAdmin({
  lignes,
  gaps,
  gapsError,
  demandesEnAttente,
  email,
}: {
  lignes: LigneDepart[];
  gaps:
    | { teamsWithoutManager: { name: string; personnes: number }[]; usersWithoutTeam: number }
    | undefined;
  gapsError: boolean;
  demandesEnAttente: Submission[];
  email: string;
}) {
  return (
    <section
      aria-labelledby="titre-suivi"
      className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md space-y-md"
    >
      <h2 id="titre-suivi" className="font-headline-sm text-headline-sm text-primary">
        Utilisateurs et équipes à suivre
      </h2>

      <section aria-labelledby="titre-departs-admin" className="space-y-xs">
        <h3
          id="titre-departs-admin"
          className="font-label-md text-label-md text-on-surface-variant uppercase"
        >
          Départs à venir
        </h3>
        {lignes.length === 0 ? (
          <p className="font-body-md italic text-on-surface-variant">Aucun départ prévu</p>
        ) : (
          <ListeDeparts lignes={lignes} email={email} />
        )}
      </section>

      <section aria-labelledby="titre-sans-manager" className="space-y-xs">
        <h3
          id="titre-sans-manager"
          className="font-label-md text-label-md text-on-surface-variant uppercase"
        >
          Équipes sans manager
        </h3>
        {gapsError && <p className="text-body-sm text-error">Les équipes sont indisponibles.</p>}
        {gaps && gaps.teamsWithoutManager.length === 0 && (
          <p className="font-body-md italic text-on-surface-variant">
            Toutes les équipes ont un manager
          </p>
        )}
        {gaps && gaps.teamsWithoutManager.length > 0 && (
          <EquipesSansManager
            equipes={gaps.teamsWithoutManager}
            demandesEnAttente={demandesEnAttente}
          />
        )}
      </section>

      {gaps && gaps.usersWithoutTeam > 0 && (
        <p className="flex items-start gap-xs font-body-md">
          <Icon name="person_off" className="text-base shrink-0" />
          <span>
            {plural(gaps.usersWithoutTeam, "utilisateur sans équipe", "utilisateurs sans équipe")}
          </span>
        </p>
      )}

      <Link
        to="/manage/users"
        className="inline-flex min-h-11 items-center font-label-md text-label-md text-primary underline underline-offset-4 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Gérer les utilisateurs et équipes
      </Link>
    </section>
  );
}

/**
 * Équipes sans manager : une ligne de synthèse, puis une liste compacte. Fond sable seulement pour les
 * équipes qui ont des demandes en attente ; les équipes sans membre sont regroupées sur une ligne.
 */
function EquipesSansManager({
  equipes,
  demandesEnAttente,
}: {
  equipes: { name: string; personnes: number }[];
  demandesEnAttente: Submission[];
}) {
  const n = equipes.length;
  const avecMembres = equipes.filter((t) => t.personnes > 0);
  const sansMembre = equipes.filter((t) => t.personnes === 0);
  return (
    <div className="space-y-xs">
      <p className="flex items-start gap-xs font-body-sm text-sm font-semibold text-on-surface">
        <Icon name="warning" className="text-base shrink-0" />
        <span>
          {`${plural(n, "équipe sans manager", "équipes sans manager")} : ${
            n > 1 ? "leurs demandes privées arrivent" : "ses demandes privées arrivent"
          } chez toi`}
        </span>
      </p>
      {avecMembres.length > 0 && (
        <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-white">
          {avecMembres.map((t) => {
            const attente = demandesEnAttente.filter(
              (s) => teamKey(s.team) === teamKey(t.name),
            ).length;
            return (
              <li
                key={t.name}
                className={`flex flex-wrap items-center justify-between gap-x-sm gap-y-xs px-sm py-xs font-label-sm text-sm text-on-surface ${attente > 0 ? "bg-[#F0D0BC]" : ""}`}
              >
                <span className="min-w-0 font-semibold wrap-anywhere">{t.name}</span>
                <span className="flex flex-wrap gap-x-sm">
                  <span>{plural(t.personnes, "personne", "personnes")}</span>
                  <span>
                    {plural(
                      attente,
                      "demande en attente à modérer",
                      "demandes en attente à modérer",
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {sansMembre.length > 0 && (
        <p className="rounded-md bg-surface-container px-sm py-xs font-label-sm text-sm text-on-surface-variant wrap-anywhere">
          {`Sans membre : ${sansMembre.map((t) => t.name).join(", ")}`}
        </p>
      )}
    </div>
  );
}

function ListeDeparts({ lignes, email }: { lignes: LigneDepart[]; email: string }) {
  return (
    <ul className="divide-y divide-outline-variant">
      {lignes.map((l) => (
        <LigneDepartItem key={l.notice.id} ligne={l} email={email} />
      ))}
    </ul>
  );
}

function LigneDepartItem({ ligne, email }: { ligne: LigneDepart; email: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const n = ligne.notice;
  const count = n.documents.length;
  const urgent = ligne.jours >= 0 && ligne.jours <= SEUIL_URGENT_JOURS;
  const passe = ligne.jours < 0;
  const limite = dateLimite(n);
  const limiteCourte = FR_COURT.format(limite);

  const mark = useMutation({
    mutationFn: () => markDepartureNoticeDownloaded(n.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departure_notices", email.toLowerCase()] }),
    onError: (e) => toast.error((e as Error).message),
  });

  async function zipAll() {
    setZipping(true);
    try {
      await downloadDepartureZip(n);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  const bouton = buttonVariants({ variant: "secondary", size: "sm" }) + " min-h-11";

  // Texte lu par les lecteurs d'écran seulement : la chip J-N reste visible
  const texteUrgence =
    ligne.jours === 0 ? ", aujourd'hui" : `, dans ${plural(ligne.jours, "jour", "jours")}`;

  // Trois zones sur une grille fixe : chaque ligne s'aligne sur les autres. Sur petit écran, elles s'empilent.
  return (
    <li className="grid grid-cols-1 items-center gap-sm py-sm md:grid-cols-[minmax(0,17rem)_minmax(0,15rem)_minmax(0,1fr)] md:gap-md">
      {/* Gauche : initiales, nom, équipe et manager */}
      <div className="flex min-w-0 items-center gap-sm">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5D5D4] font-label-sm font-semibold text-[#28282D]"
        >
          {ligne.initiales}
        </span>
        <div className="min-w-0">
          <p className="font-body-md text-on-surface wrap-anywhere">
            <span className="font-bold">{ligne.nom}</span>
            {ligne.equipe && <span className="text-[#68686D]">{` · ${ligne.equipe}`}</span>}
          </p>
          {ligne.managers !== null &&
            (ligne.managers.length === 0 ? (
              <p className={`flex items-start gap-xs font-label-sm text-sm font-semibold ${ROUGE}`}>
                <Icon name="warning" className="text-base shrink-0" />
                <span>Sans manager</span>
              </p>
            ) : (
              <p
                className="font-label-sm text-sm text-[#68686D] wrap-anywhere"
                title={`Manager : ${ligne.managers.join(" et ")}`}
              >
                {`Manager : ${ligne.managers.join(" et ")}`}
              </p>
            ))}
        </div>
      </div>

      {/* Milieu : date de départ et délai, colonne fixe */}
      <p
        className={`flex flex-wrap items-center gap-x-xs gap-y-xs font-label-sm text-sm ${urgent ? `font-semibold ${ROUGE}` : "text-on-surface"}`}
      >
        <Icon name="calendar_month" className="text-base shrink-0" />
        <span className="whitespace-nowrap">{`Départ le ${FR_LONG.format(dateDepart(n.departure_date))}`}</span>
        {urgent && <span className="sr-only">{texteUrgence}</span>}
        <span
          className={`shrink-0 rounded-full px-sm py-[2px] text-sm font-semibold ${urgent ? "bg-[#FFDAD6] text-[#A81E25]" : "bg-[#EDEBE6] text-[#28282D]"}`}
        >
          {passe ? "Passé" : ligne.jours === 0 ? "Aujourd'hui" : `J-${ligne.jours}`}
        </span>
      </p>

      {/* Droite : état des documents, puis le bouton, alignés à droite */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-xs md:justify-end">
        {count > 0 ? (
          <p className={`flex items-center gap-xs font-label-sm text-sm font-semibold ${ROUGE}`}>
            <Icon name="attach_file" className="text-base shrink-0" />
            {plural(count, "document", "documents")}
          </p>
        ) : (
          <p className="font-label-sm text-sm text-on-surface-variant">Aucun document requis</p>
        )}
        {count > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-xs">
            <button
              type="button"
              className={bouton}
              onClick={zipAll}
              disabled={zipping}
              aria-label={`Télécharger les documents de ${ligne.nom} avant le ${limiteCourte}`}
            >
              {zipping ? "Préparation…" : `Télécharger avant le ${limiteCourte}`}
            </button>
            <button
              type="button"
              className={bouton}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={`${open ? "Masquer" : "Voir"} les documents de ${ligne.nom}`}
            >
              {open ? "Masquer les documents" : "Voir les documents"}
            </button>
            <button
              type="button"
              className={bouton}
              onClick={() => mark.mutate()}
              disabled={mark.isPending}
              aria-label={`J'ai téléchargé les documents de ${ligne.nom}`}
            >
              J'ai téléchargé les documents
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={bouton}
            onClick={() => mark.mutate()}
            disabled={mark.isPending}
            aria-label={`J'ai pris note du départ de ${ligne.nom}`}
          >
            <Icon name="check" className="text-base" />
            J'ai pris note
          </button>
        )}
      </div>

      {open && (
        <ul className="space-y-xs border-t border-outline-variant pt-xs md:col-span-3">
          {n.documents.map((d) => (
            <li
              key={d.path}
              className="flex flex-wrap items-center justify-between gap-xs text-body-sm"
            >
              <span>
                <span className="font-bold">{FR_LONG.format(new Date(d.created_at))}</span> ·{" "}
                {d.excerpt}
              </span>
              <button
                type="button"
                aria-label={`Télécharger le document du ${FR_COURT.format(new Date(d.created_at))} de ${ligne.nom}`}
                className="min-h-11 text-primary underline font-label-sm text-sm"
                onClick={() =>
                  downloadAttachment(d.path, d.name).catch((e) =>
                    toast.error((e as Error).message),
                  )
                }
              >
                Télécharger
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
