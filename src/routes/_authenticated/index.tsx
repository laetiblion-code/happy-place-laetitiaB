import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorSummary, Field, FormActions, Modal, TextArea, TextInput } from "@/components/manage/crud-ui";
import { rejectionSchema, submissionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { SessionHeader } from "@/components/session-header";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { SubmissionReader } from "@/components/submission-reader";
import { ChoiceGroup, SUBMISSION_CATEGORY_OPTIONS, SUBMISSION_VISIBILITY_OPTIONS } from "@/components/submission-choices";
import { ManagerCards } from "@/components/home-counters";
import { fetchAlertCounts, fetchDelaiValidation, fetchDraftCounts, fetchMyCounts, fetchPublicationActus, fetchReviewCounts, fetchReviewList } from "@/lib/home-counts";
import { AlertsKanban } from "@/components/alerts-kanban";
import { buttonVariants } from "@/components/ui/button";
import { LienBasBloc } from "@/components/chips";
import { DepartureNotices } from "@/components/departure-notices";
import { ActualitesCabinet } from "@/components/actualites-cabinet";
import { DemandesATraiter } from "@/components/demandes-a-traiter";
import { MesDemandes } from "@/components/mes-demandes";
import { DemandesCabinet } from "@/components/cabinet-demandes";
import { useExportMesDemandes } from "@/hooks/use-export-mes-demandes";
import { CLARIFY_CATEGORY } from "@/components/status-badge";
import {
  fetchDashboardMetrics,
  fetchLastStatusChanges,
  fetchMySubmissions,
  REJECTION_CATEGORIES,
  type Submission,
  reviewSubmission,
  submitIdea,
  type SubmissionInput,
} from "@/lib/dashboard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Accueil · Happy Place" },
      {
        name: "description",
        content:
          "Pilotez les missions de recrutement IT et digital, les demandes des équipes, les alertes opérationnelles et les indicateurs du cabinet.",
      },
      { property: "og:title", content: "Accueil · Happy Place" },
      {
        property: "og:description",
        content:
          "Suivez l'activité du cabinet, les missions de recrutement, les alertes et les indicateurs clés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagerSpace,
});

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

const SANS_CHANGEMENT = new Map<string, { new_status: string; changed_at: string }>();

function ManagerSpace() {
  const qc = useQueryClient();
  const { role, email } = Route.useRouteContext();
  const isAdmin = role === "admin";
  const canReview = role === "admin" || role === "manager";
  // Rôle transmis aux blocs : un rôle inconnu est traité comme collaborateur
  const roleAffiche = role === "admin" || role === "manager" ? role : "collaborateur";
  const myEmail = (email ?? "").toLowerCase();
  // Prénom et nom viennent de la ligne de la personne connectée (lisible par RLS) ; sans nom, l'e-mail
  const profile = useQuery({
    queryKey: ["allowed_user_profile", myEmail],
    enabled: !!myEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("first_name, last_name, team")
        .eq("email", myEmail)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  // Nom affiché et enregistré : prénom et nom de la ligne allowed_users ; sans nom, l'e-mail
  const profileName = [profile.data?.first_name, profile.data?.last_name]
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const myName = profileName || myEmail;
  // Ouverture de la rédaction d'actualité depuis l'en-tête (compteur : chaque clic ouvre la fenêtre)
  const [ouvertureActu, setOuvertureActu] = useState(0);
  const [submissionForm, setSubmissionForm] = useState<SubmissionInput | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<FieldErrors>({});
  const myTeams = useQuery({
    queryKey: ["manager_teams", "mine", email],
    enabled: role === "manager" && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_teams")
        .select("team, allowed_users!inner(email)")
        .eq("allowed_users.email", (email ?? "").toLowerCase());
      if (error) throw error;
      return (data ?? []).map((t) => t.team).sort();
    },
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  // Refus ou demande de clarification : la clarification préremplit le motif « à clarifier »
  const [modeRefus, setModeRefus] = useState<"refus" | "clarification">("refus");
  const [reading, setReading] = useState<Submission | null>(null);
  const [rejectForm, setRejectForm] = useState({ rejection_category: "", rejection_note: "" });
  const [rejectErrors, setRejectErrors] = useState<FieldErrors>({});
  const exporter = useExportMesDemandes(email ?? "");

  // Demandes à traiter : mêmes filtres que la carte « Demandes en attente » (hors ses propres demandes, équipes gérées)
  const toReview = useQuery({
    queryKey: ["submissions", "to-review", role, myEmail, myTeams.data],
    enabled: canReview && !!email && (isAdmin || myTeams.isSuccess),
    queryFn: () => fetchReviewList(myEmail, isAdmin ? null : (myTeams.data ?? [])),
    retry: false,
  });
  const mine = useQuery({
    queryKey: ["submissions", "mine", email],
    queryFn: () => fetchMySubmissions(email ?? ""),
    enabled: !!email,
    retry: false,
  });
  // Dernier changement de statut de chaque demande affichée (délais « depuis »)
  const reviewIds = (toReview.data ?? []).map((s) => s.id);
  const reviewChanges =
    useQuery({
      queryKey: ["submissions", "last-changes", reviewIds],
      enabled: reviewIds.length > 0,
      queryFn: () => fetchLastStatusChanges(reviewIds),
      retry: false,
    }).data ?? SANS_CHANGEMENT;
  const mineIds = (mine.data ?? []).map((s) => s.id);
  const mineChanges =
    useQuery({
      queryKey: ["submissions", "last-changes", mineIds],
      enabled: mineIds.length > 0,
      queryFn: () => fetchLastStatusChanges(mineIds),
      retry: false,
    }).data ?? SANS_CHANGEMENT;
  const dashMetrics = useQuery({ queryKey: ["metrics", "dashboard"], queryFn: fetchDashboardMetrics, retry: false });
  // Compteurs de l'accueil : invalidés par toutes les mutations qui changent un statut, un brouillon ou une alerte
  const homeReview = useQuery({
    queryKey: ["home-counts", "review", role, myEmail, myTeams.data],
    enabled: canReview && !!email && (isAdmin || myTeams.isSuccess),
    queryFn: () => fetchReviewCounts(myEmail, isAdmin ? null : (myTeams.data ?? [])),
    retry: false,
  });
  const homeDrafts = useQuery({
    queryKey: ["home-counts", "drafts", role, myEmail],
    enabled: canReview && !!email,
    queryFn: () => fetchDraftCounts(myEmail, isAdmin),
    retry: false,
  });
  const homeAlerts = useQuery({
    queryKey: ["home-counts", "alerts", role],
    enabled: canReview,
    queryFn: () => fetchAlertCounts(isAdmin),
    retry: false,
  });
  const homeMine = useQuery({
    queryKey: ["home-counts", "mine", myEmail],
    enabled: !canReview && !!email,
    queryFn: () => fetchMyCounts(myEmail),
    retry: false,
  });
  // Objectifs du trimestre : délai de validation (cabinet ou équipes gérées) et publication des actualités (admin)
  const homeDelai = useQuery({
    queryKey: ["home-counts", "delai", role, myEmail, myTeams.data],
    enabled: canReview && !!email && (isAdmin || myTeams.isSuccess),
    queryFn: () => fetchDelaiValidation(isAdmin ? null : (myTeams.data ?? [])),
    retry: false,
  });
  const homeActus = useQuery({
    queryKey: ["home-counts", "actus"],
    enabled: isAdmin,
    queryFn: fetchPublicationActus,
    retry: false,
  });

  const review = useMutation({
    mutationFn: reviewSubmission,
    onSuccess: (_d, vars) => {
      if (vars.status === "refusée") {
        setRejecting(null);
        toast.success(vars.rejection_category === CLARIFY_CATEGORY ? "Clarification demandée" : "Demande refusée");
      } else {
        setReading((r) => (r?.id === vars.id ? null : r));
        toast.success("Demande validée");
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  function startReject(s: Submission, mode: "refus" | "clarification" = "refus") {
    setReading(null);
    setRejecting(s);
    setModeRefus(mode);
    setRejectErrors({});
    setRejectForm({
      rejection_category: mode === "clarification" ? CLARIFY_CATEGORY : "",
      rejection_note: "",
    });
  }

  const submit = useMutation({
    mutationFn: (input: SubmissionInput) => submitIdea({
      author_name: input.author_name,
      team: input.team,
      content: input.content,
      category: input.category,
      visibility: input.visibility,
    }, attachment),
    onSuccess: () => {
      setSubmissionForm(null);
      setAttachment(null);
      setSubmissionErrors({});
      toast.success(canReview ? "Demande publiée" : "Demande envoyée");
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  const roleIntro =
    role === "manager"
      ? "Gère les validations prioritaires de ton équipe et consulte les actualités du cabinet."
      : role === "admin"
        ? "Suis ce qui attend une action dans tout le cabinet."
        : "Suis tes demandes et retrouve les actualités du cabinet.";
  const greeting = profile.data?.first_name?.trim() ? `Bonjour ${profile.data.first_name.trim()}` : "Bonjour";

  function openSubmissionForm() {
    setSubmissionErrors({});
    const only = role === "manager" && myTeams.data?.length === 1 ? myTeams.data[0] : "";
    setSubmissionForm({
      author_name: profileName, team: only, content: "", status: "en attente",
      category: null, visibility: "privée",
    });
  }

  function sendSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionForm) return;
    // Collaborators: team is set server-side from their account
    // Admin: always the « Admin » team (set server-side); manager: one of their teams
    const team = role === "collaborateur" ? "auto" : role === "admin" ? "Admin" : submissionForm.team;
    // Le nom vient du profil quand il existe : le champ n'est plus saisi
    const author_name = profileName || submissionForm.author_name;
    const result = validate(submissionSchema, { ...submissionForm, author_name, team, status: "en attente" });
    // Le type est obligatoire pour une nouvelle demande (les anciennes n'en ont pas)
    const categoryError = submissionForm.category ? undefined : "Choisis un type de demande.";
    if (!result.ok || categoryError) {
      setSubmissionErrors({
        ...(result.ok ? {} : result.errors),
        ...(categoryError ? { category: categoryError } : {}),
      });
      return;
    }
    setSubmissionErrors({});
    submit.mutate(result.data);
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <SessionHeader />
      <main id="contenu" tabIndex={-1} className="focus:outline-none flex-grow w-full max-w-interface mx-auto p-sm md:p-md space-y-lg">
        <header className="flex flex-wrap items-end justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <h1 className="font-headline-lg text-headline-lg text-primary wrap-anywhere">{greeting}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-prose">{roleIntro}</p>
          </div>
          <div className="flex flex-wrap gap-xs">
            <button type="button" onClick={openSubmissionForm} className={buttonVariants({ variant: "default" })}>
              <Icon name="add" /> Nouvelle demande
            </button>
            {canReview && (
              <button
                type="button"
                onClick={() => setOuvertureActu((n) => n + 1)}
                className={buttonVariants({ variant: "secondary" })}
              >
                <Icon name="edit_note" /> Nouvelle actualité
              </button>
            )}
          </div>
        </header>

        {/* 1. Compteurs (manager et admin) */}
        {canReview && (
          <ManagerCards
            isAdmin={isAdmin}
            review={homeReview.data}
            drafts={homeDrafts.data}
            alerts={homeAlerts.data}
            delai={homeDelai.data}
            actus={homeActus.data}
          />
        )}

        {/* 2. Départs à venir (et équipes à suivre pour l'admin) */}
        {email && (
          <DepartureNotices
            email={email}
            role={roleAffiche}
            equipesGerees={myTeams.data ?? []}
            demandesEnAttente={toReview.data}
          />
        )}

        {canReview ? (
          /* 3. Demandes à traiter à gauche, actualités à droite */
          <div className="grid grid-cols-1 items-start gap-md lg:grid-cols-2">
            <DemandesATraiter
              items={toReview.data}
              error={toReview.isError}
              pending={homeReview.data?.pending ?? 0}
              changes={reviewChanges}
              validant={review.isPending}
              onRead={setReading}
              onRefuser={(s) => startReject(s)}
              onClarifier={(s) => startReject(s, "clarification")}
              onValider={(s) => review.mutate({ id: s.id, status: "validée" })}
            />
            <ActualitesCabinet role={roleAffiche} email={myEmail} auteur={myName} equipe={profile.data?.team ?? ""} ouvertureDemandee={ouvertureActu} />
          </div>
        ) : (
          /* Collaborateur : ses demandes, puis les actualités du cabinet */
          <>
            <MesDemandes
              items={mine.data}
              isError={mine.isError}
              changes={mineChanges}
              counts={homeMine.data}
              exporting={exporter.isPending}
              onExport={() => exporter.mutate()}
              onRead={setReading}
            />
            <ActualitesCabinet role={roleAffiche} email={myEmail} auteur={myName} equipe={profile.data?.team ?? ""} ouvertureDemandee={ouvertureActu} />
          </>
        )}

        {/* 4. 10 dernières demandes du cabinet (tous les rôles) */}
        <DemandesCabinet
          email={myEmail}
          role={roleAffiche}
          managerTeams={myTeams.data ?? []}
          onRead={setReading}
        />

          {/* Alertes opérationnelles en quatre colonnes (tous les rôles) */}
          <AlertsKanban isAdmin={isAdmin} />

          {/* Performance Hub */}
          <section aria-labelledby="titre-indicateurs" className="rounded-lg bg-surface-container-lowest border border-outline-variant p-md flex flex-col">
            <div className="flex items-center justify-between mb-md">
              <h2 id="titre-indicateurs" className="font-headline-sm text-headline-sm text-primary">Indicateurs clés</h2>
            </div>
            {dashMetrics.isError && (
              <p className="text-body-sm text-error mb-md">Les indicateurs sont indisponibles.</p>
            )}
            {dashMetrics.isSuccess && dashMetrics.data.length === 0 && (
              <p className="text-body-sm italic text-on-surface-variant mb-md">
                Aucun indicateur affiché sur l'accueil.
                {isAdmin ? " Choisis-en jusqu'à quatre dans la gestion des indicateurs." : ""}
              </p>
            )}
            <div className="grid grid-cols-1 gap-sm mb-md md:grid-cols-2 lg:grid-cols-4">
              {dashMetrics.data?.map((m) => (
                <DashboardMetricCard key={m.key} metric={m} />
              ))}
            </div>
            {isAdmin && (
              <LienBasBloc to="/manage/metrics" align="droite">
                Gérer les indicateurs
              </LienBasBloc>
            )}
          </section>
      </main>
      <SubmissionReader
        submission={reading}
        onClose={() => setReading(null)}
        onReject={reading && canReview && reading.status === "en attente" ? () => startReject(reading) : undefined}
        onApprove={
          reading && canReview && reading.status === "en attente"
            ? () => review.mutate({ id: reading.id, status: "validée" })
            : undefined
        }
        approving={review.isPending}
      />
      {rejecting && (
        <Modal title={modeRefus === "clarification" ? "Demander une clarification" : "Refuser la demande"} onClose={() => setRejecting(null)}>
          <form
            noValidate
            className="space-y-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const res = validate(rejectionSchema, rejectForm);
              if (!res.ok) return setRejectErrors(res.errors);
              setRejectErrors({});
              review.mutate({ id: rejecting.id, status: "refusée", ...res.data });
            }}
          >
            <p className="max-h-48 overflow-y-auto border border-outline-variant bg-surface-container-low p-xs text-body-sm italic text-on-surface-variant whitespace-pre-line wrap-anywhere">“{rejecting.content}”</p>
            <ErrorSummary errors={rejectErrors} />
            <Field label="Motif du refus" error={rejectErrors.rejection_category}>
              <select name="motif-refus"
                className="w-full border border-outline-variant bg-card p-xs text-body-sm"
                value={rejectForm.rejection_category}
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_category: e.target.value })}
              >
                <option value="">Choisir un motif</option>
                {REJECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label={modeRefus === "clarification" ? "Question pour le collaborateur (obligatoire)" : "Raison du refus (obligatoire)"} error={rejectErrors.rejection_note}>
              <TextArea
                rows={4}
                value={rejectForm.rejection_note}
                placeholder={modeRefus === "clarification" ? "Pose ta question au collaborateur…" : "Explique au collaborateur pourquoi sa demande est refusée…"}
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_note: e.target.value })}
              />
              <CharCounter value={rejectForm.rejection_note} max={500} />
            </Field>
            <FormActions pending={review.isPending} onCancel={() => setRejecting(null)} />
          </form>
        </Modal>
      )}
      {submissionForm && (
        <Modal title="Nouvelle demande" onClose={() => setSubmissionForm(null)}>
          <form onSubmit={sendSubmission} className="space-y-sm" noValidate>
            <ErrorSummary errors={submissionErrors} />
            <ChoiceGroup
              legend="Type de demande"
              name="submission-category"
              layout="cards"
              options={SUBMISSION_CATEGORY_OPTIONS}
              value={submissionForm.category}
              error={submissionErrors.category}
              onChange={(v) => setSubmissionForm({ ...submissionForm, category: v })}
            />
            {profileName ? (
              <Field label="Nom">
                <p className="font-body-md text-on-surface wrap-anywhere">{profileName}</p>
              </Field>
            ) : (
              <Field label="Nom" error={submissionErrors.author_name}>
                <TextInput
                  value={submissionForm.author_name}
                  maxLength={80}
                  placeholder="Ton nom"
                  onChange={(e) => setSubmissionForm({ ...submissionForm, author_name: e.target.value })}
                />
              </Field>
            )}
            {role === "manager" && (
              <Field label="Équipe" error={submissionErrors.team}>
                <select name="equipe-demande"
                  required
                  value={submissionForm.team}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, team: e.target.value })}
                  className="w-full border border-[#8A8A90] bg-surface px-sm py-xs font-body-md"
                >
                  <option value="">Choisis une de tes équipes</option>
                  {myTeams.data?.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}
            {role === "collaborateur" && (
              <Field label="Équipe">
                <p className="font-body-md text-on-surface wrap-anywhere">
                  {profile.data?.team ?? "Aucune équipe renseignée. Demande à un admin de t'en affecter une."}
                </p>
              </Field>
            )}
            {role === "admin" && (
              <p className="text-body-sm text-on-surface-variant">Équipe : Admin</p>
            )}
            <Field label="Ta demande" error={submissionErrors.content}>
              <TextArea
                rows={5}
                value={submissionForm.content}
                placeholder="Décris ta demande en quelques lignes."
                onChange={(e) => setSubmissionForm({ ...submissionForm, content: e.target.value })}
              />
              <CharCounter value={submissionForm.content} max={2000} min={5} />
            </Field>
            <ChoiceGroup
              legend="Qui peut la voir ?"
              name="submission-visibility"
              layout="pills"
              options={SUBMISSION_VISIBILITY_OPTIONS}
              value={submissionForm.visibility}
              error={submissionErrors.visibility}
              onChange={(v) => setSubmissionForm({ ...submissionForm, visibility: v })}
            />
            <Field label="Document PDF (optionnel, 20 Mo max)" error={submissionErrors.attachment}>
              <div className="flex flex-wrap items-center gap-xs">
                {/* Vrai champ fichier, masqué visuellement mais focusable : le bouton visible s'y rattache */}
                <input
                  ref={attachmentInput}
                  id="submission-attachment"
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Choisir un PDF"
                  aria-describedby="submission-attachment-status"
                  className="peer sr-only"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      attachmentInput.current?.click();
                    }
                  }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.type !== "application/pdf") {
                      setSubmissionErrors({ ...submissionErrors, attachment: "Fichier refusé : PDF uniquement, 20 Mo maximum." });
                      e.target.value = ""; setAttachment(null); return;
                    }
                    if (f && f.size > 20 * 1024 * 1024) {
                      setSubmissionErrors({ ...submissionErrors, attachment: "Fichier refusé : PDF uniquement, 20 Mo maximum." });
                      e.target.value = ""; setAttachment(null); return;
                    }
                    const { attachment: _a, ...rest } = submissionErrors;
                    setSubmissionErrors(rest);
                    setAttachment(f);
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => attachmentInput.current?.click()}
                  className={`${buttonVariants({ variant: "secondary" })} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2`}
                >
                  Choisir un PDF
                </button>
                <span id="submission-attachment-status" className="text-body-sm text-on-surface-variant wrap-anywhere">
                  {attachment ? attachment.name : "Aucun fichier"}
                </span>
                {attachment && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      if (attachmentInput.current) attachmentInput.current.value = "";
                    }}
                    className="font-label-sm text-label-sm text-primary underline underline-offset-2 min-h-11 px-xs"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </Field>
            <FormActions
              pending={submit.isPending || profile.isPending}
              submitLabel="Envoyer"
              onCancel={() => setSubmissionForm(null)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
