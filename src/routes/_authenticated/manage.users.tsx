import { createFileRoute } from "@tanstack/react-router";
import { useConfirm } from "@/components/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BulkImport } from "@/components/manage/bulk-import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { countAttachmentDeletionQueue, processAttachmentDeletionQueue } from "@/lib/dashboard";
import {
  ChipStatut,
  CLASSE_LIEN_ACTION,
  CLASSE_LIEN_SUPPRIMER,
  COULEUR_STATUT,
  TEXTE_SOULIGNE,
} from "@/components/chips";
import { initialesDe } from "@/lib/noms";

export const Route = createFileRoute("/_authenticated/manage/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs et équipes · Happy Place" },
      {
        name: "description",
        content: "Liste blanche des comptes Google autorisés à se connecter.",
      },
      { property: "og:title", content: "Utilisateurs et équipes · Happy Place" },
      { property: "og:description", content: "Gérer qui peut accéder à Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type AppRole = "admin" | "manager" | "collaborateur";
type Row = {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
  teams: string[];
  team: string | null;
  departure_date: string | null;
  first_name: string | null;
  last_name: string | null;
};
type LoginStatus = {
  email: string;
  a_un_compte: boolean;
  mot_de_passe_cree: boolean;
  derniere_connexion: string | null;
  a_du_contenu: boolean;
};
type Connexion = "jamais" | "lien" | "mdp";
const nameSchema = z.string().trim().max(100, "100 caractères maximum");
const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide").max(255);
const teamSchema = z
  .string()
  .trim()
  .min(2, "Nom d'équipe trop court")
  .max(60, "60 caractères maximum");

function connexionOf(s: LoginStatus | undefined): Connexion {
  if (!s || !s.a_un_compte || !s.derniere_connexion) return "jamais";
  return s.mot_de_passe_cree ? "mdp" : "lien";
}
const formatDateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const normaliser = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function UsersPage() {
  const [demander, dialogueConfirm] = useConfirm();
  const qc = useQueryClient();
  const { email: me } = Route.useRouteContext();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AppRole>("collaborateur");
  const [newTeam, setNewTeam] = useState("");
  const [newTeams, setNewTeams] = useState<string[]>([]);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<{
    id: string;
    first: string;
    last: string;
  } | null>(null);
  const [memberTeams, setMemberTeams] = useState<Record<string, string>>({});
  const [teamInputs, setTeamInputs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["allowed_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_users")
        .select(
          "id, email, first_name, last_name, team, departure_date, created_at, allowed_user_roles(role), manager_teams(team)",
        )
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        team: user.team,
        departure_date: user.departure_date,
        role: user.allowed_user_roles?.role ?? "collaborateur",
        teams: user.manager_teams.map((entry) => entry.team).sort(),
      })) as Row[];
    },
  });
  const statuses = useQuery({
    queryKey: ["admin_users_status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_users_status");
      if (error) throw error;
      return new Map((data ?? []).map((s) => [s.email, s as LoginStatus]));
    },
  });
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("name, is_reserved");
      if (error) throw error;
      return (data ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      );
    },
  });
  const selectableTeams = (teamsQuery.data ?? [])
    .filter((t) => !t.is_reserved && t.name.toLowerCase() !== "admin")
    .map((t) => t.name);
  const [roleDialog, setRoleDialog] = useState<{ id: string; email: string; team: string } | null>(
    null,
  );
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["allowed_users"] });
    qc.invalidateQueries({ queryKey: ["admin_users_status"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
  };
  const onError = (e: unknown) => toast.error((e as Error).message);

  const add = useMutation({
    mutationFn: async (v: {
      email: string;
      role: AppRole;
      teams: string[];
      first_name: string | null;
      last_name: string | null;
    }) => {
      const { data, error } = await supabase
        .from("allowed_users")
        .insert({
          email: v.email,
          team: v.role === "collaborateur" ? v.teams[0] : null,
          first_name: v.first_name,
          last_name: v.last_name,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(
          error.code === "23505" ? "Cet email est déjà dans la liste" : error.message,
        );
      const { error: roleError } = await supabase
        .from("allowed_user_roles")
        .insert({ allowed_user_id: data.id, role: v.role });
      if (roleError) {
        await supabase.from("allowed_users").delete().eq("id", data.id);
        throw roleError;
      }
      if (v.role === "manager") {
        const { error: teamError } = await supabase
          .from("manager_teams")
          .insert(v.teams.map((team) => ({ allowed_user_id: data.id, team })));
        if (teamError) {
          await supabase.from("allowed_users").delete().eq("id", data.id);
          throw new Error(teamError.message);
        }
      }
    },
    onSuccess: () => {
      setEmail("");
      setNewTeam("");
      setNewTeams([]);
      setFirstName("");
      setLastName("");
      toast.success("Utilisateur ajouté");
      refresh();
    },
    onError,
  });
  const saveName = useMutation({
    mutationFn: async (v: { id: string; first: string; last: string }) => {
      const first = nameSchema.safeParse(v.first);
      if (!first.success) throw new Error("Prénom : " + first.error.issues[0].message);
      const last = nameSchema.safeParse(v.last);
      if (!last.success) throw new Error("Nom : " + last.error.issues[0].message);
      const { data, error } = await supabase
        .from("allowed_users")
        .update({ first_name: first.data || null, last_name: last.data || null })
        .eq("id", v.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
    },
    onSuccess: () => {
      setEditingName(null);
      toast.success("Nom enregistré");
      refresh();
    },
    onError,
  });
  const removeNeverLogged = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("allowed_users")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Suppression refusée : vérifie que tu es admin");
    },
    onSuccess: () => {
      toast.success("Utilisateur supprimé de la liste");
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: async (v: { id: string; role: AppRole; team?: string }) => {
      if (v.role === "collaborateur") {
        const parsed = teamSchema.safeParse(v.team ?? "");
        if (!parsed.success)
          throw new Error(
            "Équipe requise pour un collaborateur : " + parsed.error.issues[0].message,
          );
        const { data, error: tErr } = await supabase
          .from("allowed_users")
          .update({ team: parsed.data })
          .eq("id", v.id)
          .select("id");
        if (tErr) throw tErr;
        if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      } else {
        const { data, error: tErr } = await supabase
          .from("allowed_users")
          .update({ team: null })
          .eq("id", v.id)
          .select("id");
        if (tErr) throw tErr;
        if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      }
      const { data: roleRows, error } = await supabase
        .from("allowed_user_roles")
        .update({ role: v.role, updated_at: new Date().toISOString() })
        .eq("allowed_user_id", v.id)
        .select("id");
      if (error) throw error;
      if (!roleRows?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      if (v.role !== "manager") {
        const { error: teamError } = await supabase
          .from("manager_teams")
          .delete()
          .eq("allowed_user_id", v.id);
        if (teamError) throw teamError;
      }
    },
    onSuccess: refresh,
    onError,
  });
  const setDeparture = useMutation({
    mutationFn: async (v: { id: string; date: string | null }) => {
      const { error } = await supabase
        .from("allowed_users")
        .update({ departure_date: v.date })
        .eq("id", v.id);
      if (error) throw error;
      return v.date;
    },
    onSuccess: (d) => {
      toast.success(d ? `Départ programmé le ${formatDate(d)}` : "Départ annulé");
      refresh();
    },
    onError,
  });
  const formatDate = (iso: string) => iso.split("-").reverse().join("/");
  const minDeparture = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const programDeparture = async (u: Row, date: string) => {
    // Prénom et nom ; l'e-mail seulement s'ils sont vides (même règle que nomAffiche)
    const nomComplet = [u.first_name, u.last_name]
      .map((p) => p?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    const personne = nomComplet || u.email;
    if (
      !(await demander({
        titre: "Programmer le départ",
        message: `Programmer le départ de ${personne} le ${formatDate(date)} ? Son accès sera supprimé à cette date. Son manager et les admins sont prévenus dès maintenant et pourront télécharger ses documents d'ici là. Tu peux annuler avec « Annuler le départ ».`,
        libelleConfirmer: "Programmer le départ",
      }))
    )
      return;
    setDeparture.mutate({ id: u.id, date });
  };
  const [departureInputs, setDepartureInputs] = useState<Record<string, string>>({});
  // Suppression seulement pour un utilisateur jamais connecté ET sans contenu
  const canDelete = (u: Row) => {
    const s = statuses.data?.get(u.email);
    return connexionOf(s) === "jamais" && !s?.a_du_contenu;
  };
  // Dernier admin : ni suppression, ni changement de rôle (la base refuse aussi)
  const adminCount = (list.data ?? []).filter((u) => u.role === "admin").length;
  const isLastAdmin = (u: Row) => u.role === "admin" && adminCount <= 1;

  const queue = useQuery({
    queryKey: ["attachment_deletion_queue"],
    queryFn: countAttachmentDeletionQueue,
  });
  const retry = useMutation({
    mutationFn: processAttachmentDeletionQueue,
    onSuccess: (r) => {
      if (r.remaining > 0) toast.error(`${r.remaining} document(s) n'ont pas pu être supprimés.`);
      else toast.success(`${r.deleted} document(s) supprimé(s)`);
    },
    onError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["attachment_deletion_queue"] }),
  });

  const addTeam = useMutation({
    mutationFn: async (v: { allowedUserId: string; team: string }) => {
      const parsed = teamSchema.safeParse(v.team);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (parsed.data.trim().toLowerCase() === "admin")
        throw new Error("L'équipe Admin est réservée aux admins.");
      const { data, error } = await supabase
        .from("manager_teams")
        .insert({ allowed_user_id: v.allowedUserId, team: parsed.data })
        .select("id");
      if (!error && !data?.length)
        throw new Error("Modification refusée : vérifie que tu es admin");
      if (error)
        throw new Error(
          error.code === "23514"
            ? "L'équipe Admin est réservée aux admins."
            : error.code === "23505"
              ? `Ce manager a déjà l'équipe « ${parsed.data} ».`
              : error.message,
        );
    },
    onSuccess: (_, variables) => {
      setTeamInputs((current) => ({ ...current, [variables.allowedUserId]: "" }));
      toast.success("Équipe attribuée");
      refresh();
    },
    onError,
  });

  const removeTeam = useMutation({
    mutationFn: async (v: { allowedUserId: string; team: string }) => {
      const { data, error } = await supabase
        .from("manager_teams")
        .delete()
        .eq("allowed_user_id", v.allowedUserId)
        .eq("team", v.team)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
    },
    onSuccess: () => {
      toast.success("Équipe retirée");
      refresh();
    },
    onError,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setErr(parsed.error.issues[0].message);
    let teams: string[] = [];
    if (role === "collaborateur") {
      if (!newTeam) return setTeamErr("Choisis une équipe.");
      teams = [newTeam];
    } else if (role === "manager") {
      if (!newTeams.length) return setTeamErr("Choisis au moins une équipe.");
      teams = newTeams;
    }
    const fn = nameSchema.safeParse(firstName);
    if (!fn.success) return setErr("Prénom : " + fn.error.issues[0].message);
    const ln = nameSchema.safeParse(lastName);
    if (!ln.success) return setErr("Nom : " + ln.error.issues[0].message);
    setErr(null);
    setTeamErr(null);
    add.mutate({
      email: parsed.data,
      role,
      teams,
      first_name: fn.data || null,
      last_name: ln.data || null,
    });
  }

  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<AppRole | "">("");
  const [filtreEquipe, setFiltreEquipe] = useState("");
  const recherchePropre = normaliser(recherche);
  const nomDe = (u: Row) =>
    [u.first_name, u.last_name]
      .map((p) => p?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
  const visibles = (list.data ?? []).filter((u) => {
    if (recherchePropre && !normaliser(`${nomDe(u)} ${u.email}`).includes(recherchePropre))
      return false;
    if (filtreRole && u.role !== filtreRole) return false;
    if (filtreEquipe) {
      const dansEquipe =
        u.role === "collaborateur"
          ? u.team === filtreEquipe
          : u.role === "manager"
            ? u.teams.includes(filtreEquipe)
            : filtreEquipe.toLowerCase() === "admin";
      if (!dansEquipe) return false;
    }
    return true;
  });
  const total = list.data?.length ?? 0;
  const filtresActifs = !!recherchePropre || !!filtreRole || !!filtreEquipe;
  const ROLE_CHIP = {
    admin: { libelle: "Admin", couleur: COULEUR_STATUT.sable },
    manager: { libelle: "Manager", couleur: COULEUR_STATUT.rose },
    collaborateur: { libelle: "Collaborateur", couleur: COULEUR_STATUT.gris },
  } as const;
  const dateCourte = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const champ = "border border-[#8A8A90] bg-surface px-sm py-xs font-body-md";
  const libelleChamp = "block font-label-sm text-label-sm text-on-surface-variant";

  function renderCarte(u: Row) {
    const enEdition = editingName?.id === u.id;
    const nom = nomDe(u);
    const dernier = isLastAdmin(u);
    const supprimable = canDelete(u) && !dernier;
    const connexion = connexionOf(statuses.data?.get(u.email));
    const dateValue = departureInputs[u.id] ?? u.departure_date ?? "";
    const idCarte = `carte-${u.id}`;
    return (
      <article
        key={u.id}
        aria-labelledby={`${idCarte}-titre`}
        className="flex flex-col gap-sm border border-outline-variant bg-surface-container-lowest p-md"
      >
        <div className="flex items-start justify-between gap-sm">
          <div className="flex min-w-0 items-start gap-sm">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5D5D4] font-bold text-[#28282D]"
            >
              {initialesDe(nom || u.email)}
            </span>
            <div className="min-w-0">
              <h3
                id={`${idCarte}-titre`}
                className="font-body-md font-bold text-primary wrap-anywhere"
              >
                {nom || u.email}
                {u.email === me && (
                  <span className="ml-xs font-normal text-on-surface-variant">(toi)</span>
                )}
              </h3>
              {nom && (
                <p className="text-body-sm text-on-surface-variant wrap-anywhere">{u.email}</p>
              )}
            </div>
          </div>
          <ChipStatut couleur={ROLE_CHIP[u.role].couleur}>{ROLE_CHIP[u.role].libelle}</ChipStatut>
        </div>

        {enEdition && (
          <div className="flex flex-wrap items-end gap-xs">
            <div className="space-y-xs">
              <label htmlFor={`${idCarte}-prenom`} className={libelleChamp}>
                Prénom
              </label>
              <input
                id={`${idCarte}-prenom`}
                name="prenom-modifie"
                value={editingName.first}
                onChange={(e) => setEditingName({ ...editingName, first: e.target.value })}
                maxLength={100}
                className={champ}
              />
            </div>
            <div className="space-y-xs">
              <label htmlFor={`${idCarte}-nom`} className={libelleChamp}>
                Nom
              </label>
              <input
                id={`${idCarte}-nom`}
                name="nom-modifie"
                value={editingName.last}
                onChange={(e) => setEditingName({ ...editingName, last: e.target.value })}
                maxLength={100}
                className={champ}
              />
            </div>
            <button
              type="button"
              disabled={saveName.isPending}
              onClick={() => saveName.mutate(editingName)}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditingName(null)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Annuler
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-xs">
          {connexion === "mdp" ? (
            <ChipStatut couleur={COULEUR_STATUT.vert} icon="check_circle">
              Mot de passe créé
            </ChipStatut>
          ) : connexion === "lien" ? (
            <ChipStatut couleur={COULEUR_STATUT.gris} icon="key">
              Mot de passe à créer
            </ChipStatut>
          ) : (
            <ChipStatut couleur={COULEUR_STATUT.gris} icon="radio_button_unchecked">
              Jamais connecté
            </ChipStatut>
          )}
          <span className="text-[13px] text-on-surface-variant">
            Ajouté le {formatDateFr(u.created_at)}
          </span>
          {u.departure_date && (
            <ChipStatut
              couleur={COULEUR_STATUT.rouge}
              icon="logout"
            >{`Part le ${dateCourte(u.departure_date)}`}</ChipStatut>
          )}
        </div>

        {u.role === "manager" && (
          <ul aria-label={`Équipes de ${u.email}`} className="flex flex-wrap items-center gap-xs">
            {u.teams.length === 0 && (
              <li className="text-body-sm italic text-on-surface-variant">Aucune équipe</li>
            )}
            {u.teams.map((team) => (
              <li
                key={team}
                className="inline-flex min-h-6 items-center gap-xs rounded-full bg-[#EDEBE6] px-sm text-[13px] text-[#28282D]"
              >
                {team}
                <button
                  type="button"
                  aria-label={`Retirer l'équipe ${team} de ${u.email}`}
                  disabled={removeTeam.isPending}
                  onClick={() => removeTeam.mutate({ allowedUserId: u.id, team })}
                  className="inline-flex size-6 items-center justify-center rounded-full text-[16px] font-bold text-on-surface-variant hover:text-[#A81E25] focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {u.role === "collaborateur" && (
          <p className="flex flex-wrap items-center gap-xs text-[13px] text-on-surface-variant">
            Équipe :
            {u.team ? (
              <span className="inline-flex min-h-6 items-center rounded-full bg-[#EDEBE6] px-sm text-[13px] text-[#28282D]">
                {u.team}
              </span>
            ) : (
              <span className="font-semibold text-[#A81E25]">Aucune équipe définie</span>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-sm border-t border-outline-variant pt-sm">
          <button
            type="button"
            onClick={() =>
              setEditingName({ id: u.id, first: u.first_name ?? "", last: u.last_name ?? "" })
            }
            aria-label={`Modifier le nom de ${u.email}`}
            className={CLASSE_LIEN_ACTION}
          >
            <Pencil aria-hidden="true" size={16} />
            <span className={TEXTE_SOULIGNE}>Modifier</span>
          </button>

          <select
            name="role-utilisateur"
            value={u.role}
            disabled={dernier}
            onChange={(e) => {
              const next = e.target.value as AppRole;
              if (next === "collaborateur") {
                setRoleDialog({ id: u.id, email: u.email, team: u.team ?? "" });
              } else
                update.mutate(
                  { id: u.id, role: next },
                  { onSuccess: () => toast.success("Rôle modifié") },
                );
            }}
            aria-label={`Rôle de ${u.email}`}
            aria-describedby={dernier ? `dernier-admin-${u.id}` : undefined}
            className={`${champ} py-1 disabled:opacity-50`}
          >
            <option value="collaborateur">Collaborateur</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>

          {u.role === "collaborateur" && (
            <div className="flex flex-wrap items-center gap-xs">
              <select
                name="equipe-membre"
                value={memberTeams[u.id] ?? u.team ?? ""}
                onChange={(e) => setMemberTeams((c) => ({ ...c, [u.id]: e.target.value }))}
                aria-label={`Équipe de ${u.email}`}
                className={`${champ} py-1`}
              >
                <option value="">Choisir une équipe</option>
                {(u.team && !selectableTeams.includes(u.team)
                  ? [u.team, ...selectableTeams]
                  : selectableTeams
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {(() => {
                const chosen = memberTeams[u.id] ?? u.team ?? "";
                const saving = update.isPending && update.variables?.id === u.id;
                return (
                  <button
                    type="button"
                    disabled={!chosen || chosen === u.team || saving}
                    onClick={() =>
                      update.mutate(
                        { id: u.id, role: "collaborateur", team: chosen },
                        {
                          onSuccess: () => {
                            toast.success("Équipe modifiée");
                            setMemberTeams((c) => {
                              const n = { ...c };
                              delete n[u.id];
                              return n;
                            });
                          },
                        },
                      )
                    }
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    {saving ? "…" : "Enregistrer"}
                  </button>
                );
              })()}
            </div>
          )}

          {u.role === "manager" && (
            <div className="flex flex-wrap items-center gap-xs">
              <select
                name="equipe-saisie"
                value={teamInputs[u.id] ?? ""}
                onChange={(e) =>
                  setTeamInputs((current) => ({ ...current, [u.id]: e.target.value }))
                }
                aria-label={`Ajouter une équipe à ${u.email}`}
                className={`${champ} py-1`}
              >
                <option value="">Choisir une équipe</option>
                {selectableTeams
                  .filter((t) => !u.teams.includes(t))
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!teamInputs[u.id] || addTeam.isPending}
                onClick={() =>
                  addTeam.mutate({ allowedUserId: u.id, team: teamInputs[u.id] ?? "" })
                }
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {addTeam.isPending && addTeam.variables?.allowedUserId === u.id ? "…" : "Ajouter"}
              </button>
            </div>
          )}

          {supprimable ? (
            <button
              type="button"
              disabled={u.email === me || removeNeverLogged.isPending}
              title={u.email === me ? "Tu ne peux pas supprimer ton propre compte" : undefined}
              onClick={async () => {
                const teamsNote =
                  u.role === "manager" && u.teams.length
                    ? ` Ses équipes (${u.teams.join(", ")}) n'auront plus de manager : leurs demandes privées arriveront chez l'admin.`
                    : "";
                if (
                  await demander({
                    titre: "Supprimer ce compte",
                    message: `Supprimer ${u.email} de la liste blanche ? Il n'a jamais été connecté : rien n'est à conserver.${teamsNote}`,
                    libelleConfirmer: "Supprimer",
                    destructive: true,
                  })
                )
                  removeNeverLogged.mutate(u.id);
              }}
              className={CLASSE_LIEN_SUPPRIMER}
            >
              <Trash2 aria-hidden="true" size={16} />
              <span className={TEXTE_SOULIGNE}>Supprimer</span>
            </button>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-xs border-t border-outline-variant pt-sm">
              <label
                htmlFor={`dep-${u.id}`}
                className="font-label-sm text-label-sm text-on-surface-variant"
              >
                Départ prévu le
              </label>
              <input
                id={`dep-${u.id}`}
                type="date"
                min={minDeparture}
                value={dateValue}
                onChange={(e) => setDepartureInputs((c) => ({ ...c, [u.id]: e.target.value }))}
                className={`${champ} py-1`}
              />
              <button
                type="button"
                disabled={setDeparture.isPending || !dateValue || dateValue < minDeparture}
                onClick={() => programDeparture(u, dateValue)}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Programmer le départ
              </button>
              {u.departure_date && (
                <button
                  type="button"
                  disabled={setDeparture.isPending}
                  onClick={() => {
                    setDepartureInputs((c) => ({ ...c, [u.id]: "" }));
                    setDeparture.mutate({ id: u.id, date: null });
                  }}
                  className={CLASSE_LIEN_ACTION}
                >
                  <span className={TEXTE_SOULIGNE}>Annuler le départ</span>
                </button>
              )}
              <p className="basis-full text-[13px] text-on-surface-variant">
                7 jours minimum, pour laisser le temps de télécharger ses documents avant
                l'anonymisation.
              </p>
            </div>
          )}
        </div>
        {dernier && (
          <p id={`dernier-admin-${u.id}`} className="text-body-sm font-semibold text-on-surface">
            Dernier admin : il faut au moins un admin. Ses actions sont désactivées.
          </p>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-md">
      <h1 className="font-headline-sm text-headline-sm text-primary">Utilisateurs et équipes</h1>
      {(queue.data ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-sm border border-error bg-surface-container-lowest p-sm">
          <p className="text-body-sm text-error">
            {queue.data} document(s) en attente de suppression
          </p>
          <button
            type="button"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
            className="px-md py-xs border border-outline text-primary font-label-md text-label-md hover:bg-surface-container disabled:opacity-50"
          >
            {retry.isPending ? "…" : "Réessayer"}
          </button>
        </div>
      )}

      <section
        aria-label="Rechercher et filtrer"
        className="flex flex-wrap items-end gap-sm border border-outline-variant bg-surface-container-lowest p-md"
      >
        <div className="min-w-56 flex-[2] space-y-xs">
          <label htmlFor="filtre-recherche" className={libelleChamp}>
            Rechercher par nom ou e-mail
          </label>
          <input
            id="filtre-recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou e-mail"
            className={`${champ} w-full`}
          />
        </div>
        <div className="space-y-xs">
          <label htmlFor="filtre-role" className={libelleChamp}>
            Rôle
          </label>
          <select
            id="filtre-role"
            value={filtreRole}
            onChange={(e) => setFiltreRole(e.target.value as AppRole | "")}
            className={champ}
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="collaborateur">Collaborateur</option>
          </select>
        </div>
        <div className="space-y-xs">
          <label htmlFor="filtre-equipe" className={libelleChamp}>
            Équipe
          </label>
          <select
            id="filtre-equipe"
            value={filtreEquipe}
            onChange={(e) => setFiltreEquipe(e.target.value)}
            className={champ}
          >
            <option value="">Toutes les équipes</option>
            {(teamsQuery.data ?? []).map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <p
          aria-live="polite"
          className="ml-auto font-label-md text-label-md text-on-surface-variant"
        >
          {filtresActifs ? `${visibles.length} sur ${total} utilisateurs` : `${total} utilisateurs`}
        </p>
      </section>

      <details className="group border border-outline-variant bg-surface-container-lowest">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-sm p-md font-label-md text-label-md text-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Ajouter un utilisateur
          <span
            aria-hidden="true"
            className="material-symbols-outlined transition-transform group-open:rotate-180"
          >
            expand_more
          </span>
        </summary>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-sm border-t border-outline-variant p-md sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-xs">
            <label htmlFor="ajout-prenom" className={libelleChamp}>
              Prénom (facultatif)
            </label>
            <input
              id="ajout-prenom"
              name="prenom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              className={`${champ} w-full`}
            />
          </div>
          <div className="space-y-xs">
            <label htmlFor="ajout-nom" className={libelleChamp}>
              Nom (facultatif)
            </label>
            <input
              id="ajout-nom"
              name="nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              className={`${champ} w-full`}
            />
          </div>
          <div className="space-y-xs">
            <label htmlFor="ajout-email" className={libelleChamp}>
              E-mail Google
            </label>
            <input
              id="ajout-email"
              name="email-google"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@gmail.com"
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? "ajout-email-erreur" : undefined}
              className={`${champ} w-full`}
            />
            {err && (
              <p id="ajout-email-erreur" role="alert" className="text-error text-sm">
                {err}
              </p>
            )}
          </div>
          <div className="space-y-xs">
            <label htmlFor="ajout-role" className={libelleChamp}>
              Rôle
            </label>
            <select
              id="ajout-role"
              name="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Row["role"]);
                setTeamErr(null);
              }}
              className={`${champ} w-full`}
            >
              <option value="collaborateur">Collaborateur</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {role === "collaborateur" && (
            <div className="space-y-xs">
              <label htmlFor="ajout-equipe" className={libelleChamp}>
                Équipe
              </label>
              <select
                id="ajout-equipe"
                name="equipe-collaborateur"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                className={`${champ} w-full`}
              >
                <option value="">Choisir une équipe</option>
                {selectableTeams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === "manager" && (
            <fieldset className="space-y-xs">
              <legend className={libelleChamp}>Équipes</legend>
              <div className="max-h-40 space-y-xs overflow-y-auto border border-[#8A8A90] bg-surface p-xs">
                {selectableTeams.map((t) => (
                  <label key={t} className="flex items-center gap-xs px-xs py-1 font-body-md">
                    <input
                      name="equipes-gerees"
                      type="checkbox"
                      checked={newTeams.includes(t)}
                      onChange={(e) =>
                        setNewTeams((c) =>
                          e.target.checked ? [...c, t] : c.filter((x) => x !== t),
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {role !== "admin" && teamErr && (
            <p className="text-error text-sm sm:col-span-2 lg:col-span-3">{teamErr}</p>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button disabled={add.isPending} className={buttonVariants({ variant: "default" })}>
              Ajouter
            </button>
          </div>
        </form>
      </details>

      <section className="space-y-sm">
        <BulkImport onImported={refresh} />
      </section>

      {visibles.length === 0 && list.isSuccess && (
        <p className="italic text-on-surface-variant">
          Aucun utilisateur ne correspond à ces filtres.
        </p>
      )}
      {list.isLoading && <p className="p-sm">Chargement…</p>}
      <div className="grid gap-sm lg:grid-cols-2">{visibles.map((u) => renderCarte(u))}</div>

      <TeamsSection users={list.data ?? []} teams={teamsQuery.data ?? []} onChanged={refresh} />

      <Dialog open={!!roleDialog} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Équipe de {roleDialog?.email}</DialogTitle>
          </DialogHeader>
          <select
            name="equipe-role"
            value={roleDialog?.team ?? ""}
            onChange={(e) => roleDialog && setRoleDialog({ ...roleDialog, team: e.target.value })}
            aria-label="Équipe du collaborateur"
            className="w-full border border-[#8A8A90] bg-surface px-sm py-xs font-body-md"
          >
            <option value="">Choisir une équipe</option>
            {selectableTeams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRoleDialog(null)}
              className={buttonVariants({ variant: "secondary" })}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!roleDialog?.team || update.isPending}
              title={!roleDialog?.team ? "Choisis d'abord une équipe" : undefined}
              onClick={() => {
                if (!roleDialog?.team) return;
                update.mutate(
                  { id: roleDialog.id, role: "collaborateur", team: roleDialog.team },
                  {
                    onSuccess: () => {
                      toast.success("Rôle modifié");
                      setRoleDialog(null);
                    },
                  },
                );
              }}
              className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50"
            >
              {update.isPending ? "…" : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogueConfirm}
    </div>
  );
}

function TeamsSection({
  users,
  teams,
  onChanged,
}: {
  users: Row[];
  teams: { name: string; is_reserved: boolean }[];
  onChanged: () => void;
}) {
  const [demander, dialogueConfirm] = useConfirm();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Les admins n'ont pas d'équipe enregistrée : l'équipe Admin compte les admins
  const count = (t: string) =>
    t.toLowerCase() === "admin"
      ? users.filter((u) => u.role === "admin").length
      : users.filter(
          (u) =>
            (u.role === "collaborateur" && u.team === t) ||
            (u.role === "manager" && u.teams.includes(t)),
        ).length;
  const onError = (e: unknown) => toast.error((e as Error).message);

  const create = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("teams").insert({ name: n });
      if (error)
        throw new Error(error.code === "23505" ? "Cette équipe existe déjà" : error.message);
    },
    onSuccess: () => {
      setName("");
      toast.success("Équipe ajoutée");
      onChanged();
    },
    onError: (e) => setErr((e as Error).message),
  });
  const rename = useMutation({
    mutationFn: async (v: { from: string; to: string }) => {
      const { error } = await supabase.from("teams").update({ name: v.to }).eq("name", v.from);
      if (error)
        throw new Error(error.code === "23505" ? "Cette équipe existe déjà" : error.message);
    },
    onSuccess: () => {
      setEditing(null);
      toast.success("Équipe renommée");
      onChanged();
    },
    onError,
  });
  const del = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("teams").delete().eq("name", n);
      if (error)
        throw new Error(
          error.code === "23503"
            ? "Impossible : cette équipe est encore utilisée (personnes ou demandes). Réaffecte-les d'abord."
            : error.message,
        );
    },
    onSuccess: () => {
      toast.success("Équipe supprimée");
      onChanged();
    },
    onError,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = teamSchema.safeParse(name);
    if (!p.success) return setErr(p.error.issues[0].message);
    setErr(null);
    create.mutate(p.data);
  }
  const managersDe = (nomEquipe: string) =>
    users.filter((u) => u.role === "manager" && u.teams.includes(nomEquipe));
  const nomPersonne = (u: Row) =>
    [u.first_name, u.last_name]
      .map((p) => p?.trim() ?? "")
      .filter(Boolean)
      .join(" ") || u.email;

  return (
    <section aria-labelledby="titre-equipes" className="space-y-sm">
      <div className="flex flex-wrap items-end justify-between gap-sm">
        <h2 id="titre-equipes" className="font-label-md text-label-md text-primary">
          Équipes
        </h2>
        <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-xs">
          <div className="space-y-xs">
            <label
              htmlFor="nouvelle-equipe"
              className="block font-label-sm text-label-sm text-on-surface-variant"
            >
              Nouvelle équipe
            </label>
            <input
              id="nouvelle-equipe"
              name="nouvelle-equipe"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              placeholder="Nom de l'équipe"
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? "nouvelle-equipe-erreur" : undefined}
              maxLength={60}
              className="border border-[#8A8A90] bg-surface px-sm py-xs font-body-md"
            />
            {err && (
              <p id="nouvelle-equipe-erreur" role="alert" className="text-error text-sm">
                {err}
              </p>
            )}
          </div>
          <button disabled={create.isPending} className={buttonVariants({ variant: "default" })}>
            Ajouter
          </button>
        </form>
      </div>
      <ul className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => {
          const enEdition = editing?.from === t.name;
          const managers = managersDe(t.name);
          return (
            <li
              key={t.name}
              className="flex flex-col gap-xs border border-outline-variant bg-surface-container-lowest p-sm"
            >
              {enEdition ? (
                <div className="flex flex-wrap items-end gap-xs">
                  <div className="space-y-xs">
                    <label
                      htmlFor={`renommer-${t.name}`}
                      className="block font-label-sm text-label-sm text-on-surface-variant"
                    >
                      Nouveau nom
                    </label>
                    <input
                      id={`renommer-${t.name}`}
                      name="nouveau-nom-equipe"
                      value={editing.to}
                      onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                      maxLength={60}
                      className="border border-[#8A8A90] bg-surface px-sm py-1 font-body-md"
                    />
                  </div>
                  <button
                    type="button"
                    className={buttonVariants({ variant: "default", size: "sm" })}
                    disabled={rename.isPending}
                    onClick={() => {
                      const p = teamSchema.safeParse(editing.to);
                      if (!p.success) return toast.error(p.error.issues[0].message);
                      rename.mutate({ from: t.name, to: p.data });
                    }}
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    onClick={() => setEditing(null)}
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-body-md font-bold text-primary wrap-anywhere">
                    {t.is_reserved && (
                      <span aria-label="Équipe réservée" title="Équipe réservée" className="mr-xs">
                        🔒
                      </span>
                    )}
                    {t.name}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {count(t.name)} personne(s)
                  </p>
                  <div className="flex flex-wrap items-center gap-xs">
                    {t.is_reserved ? null : managers.length > 0 ? (
                      <span className="text-body-sm text-on-surface wrap-anywhere">
                        {`Manager : ${managers.map(nomPersonne).join(", ")}`}
                      </span>
                    ) : (
                      <ChipStatut couleur={COULEUR_STATUT.gris} icon="person_off">
                        Sans manager
                      </ChipStatut>
                    )}
                  </div>
                  {!t.is_reserved && (
                    <div className="mt-auto flex flex-wrap items-center gap-md border-t border-outline-variant pt-xs">
                      <button
                        type="button"
                        className={CLASSE_LIEN_ACTION}
                        onClick={() => setEditing({ from: t.name, to: t.name })}
                      >
                        <span className={TEXTE_SOULIGNE}>Renommer</span>
                      </button>
                      <button
                        type="button"
                        className={CLASSE_LIEN_SUPPRIMER}
                        disabled={del.isPending}
                        onClick={async () => {
                          if (
                            await demander({
                              titre: "Supprimer l'équipe",
                              message: `Supprimer l'équipe « ${t.name} » ?`,
                              libelleConfirmer: "Supprimer",
                              destructive: true,
                            })
                          )
                            del.mutate(t.name);
                        }}
                      >
                        <span className={TEXTE_SOULIGNE}>Supprimer</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {dialogueConfirm}
    </section>
  );
}
